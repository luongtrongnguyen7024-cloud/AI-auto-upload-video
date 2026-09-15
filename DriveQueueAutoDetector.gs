/**
 * PTAT Drive -> Content Queue detector
 *
 * What it does:
 * - Checks the configured Drive folder every 15 minutes.
 * - Accepts only files named exactly PTAT-<number>.mp4 (case-insensitive).
 * - Finds the matching Content ID row in Content Queue.
 * - Writes VIDEO_READY and the Drive link without touching caption/script.
 * - Does not requeue rows deliberately set to BỎ QUA or already ĐÃ ĐĂNG.
 * - Can optionally publish one ready Reel directly to Meta/Facebook.
 *
 * The direct publisher has no Make data-transfer dependency. It remains
 * disabled until createOrResetReelPublishTrigger() is run manually.
 */

const PTAT_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1ut8gLmqhQC_5mWm-CxqgF-L-4ugFhjtoxvDkyIdK5s0',
  SHEET_NAME: 'Content Queue',
  INTAKE_FOLDER_ID: '1iMihy_Ge2gQV3nmXj0i7QuZ8RRtJPm6Q',
  VIDEO_NAME: /^(PTAT-\d+)\.mp4$/i,
  HANDLER: 'syncDriveVideosToQueue',
  PUBLISH_HANDLER: 'publishReadyReelToFacebook',
  PUBLISH_SCHEDULE_HOURS: Object.freeze([8, 12, 20]),
  TIME_ZONE: 'Asia/Ho_Chi_Minh',
  MAX_REELS_PER_DAY: 3,
  META_GRAPH_VERSION: 'v26.0',
  META_PAGE_ACCESS_TOKEN_PROPERTY: 'PTAT_META_PAGE_ACCESS_TOKEN',
  META_IN_FLIGHT_PROPERTY: 'PTAT_REEL_IN_FLIGHT',
  META_DAILY_COUNT_PROPERTY: 'PTAT_REEL_DAILY_COUNT',
  MAX_URLFETCH_FILE_BYTES: 50 * 1024 * 1024,
});

const REQUIRED_HEADERS = Object.freeze([
  'Content ID',
  'Trạng thái video',
  'Trạng thái đăng tự động',
  'Trạng thái đăng',
  'Ngày đăng',
  'File video (Drive)',
  'Caption Facebook',
]);

/** Run this once manually after pasting the project. */
function createOrResetQuarterHourTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === PTAT_CONFIG.HANDLER)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(PTAT_CONFIG.HANDLER)
    .timeBased()
    .everyMinutes(15)
    .create();
}

/**
 * Creates the direct Facebook publisher schedule. This is intentionally a
 * separate, manual action: do not run it until the Page token is stored and
 * the no-network validation has passed.
 */
function createOrResetReelPublishTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === PTAT_CONFIG.PUBLISH_HANDLER)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  PTAT_CONFIG.PUBLISH_SCHEDULE_HOURS.forEach((hour) => {
    ScriptApp.newTrigger(PTAT_CONFIG.PUBLISH_HANDLER)
      .timeBased()
      .atHour(hour)
      .nearMinute(0)
      .everyDays(1)
      .inTimezone(PTAT_CONFIG.TIME_ZONE)
      .create();
  });
}

/** Stops only the direct publisher schedule. The Drive detector stays active. */
function disableReelPublishTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === PTAT_CONFIG.PUBLISH_HANDLER)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

/** The installed 15-minute trigger calls this function. */
function syncDriveVideosToQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.log('Another synchronization is already running.');
    return;
  }

  try {
    const sheet = SpreadsheetApp.openById(PTAT_CONFIG.SPREADSHEET_ID)
      .getSheetByName(PTAT_CONFIG.SHEET_NAME);
    if (!sheet) throw new Error(`Missing sheet: ${PTAT_CONFIG.SHEET_NAME}`);

    const values = sheet.getDataRange().getDisplayValues();
    if (values.length < 2) return;

    const column = indexHeaders_(values[0]);
    const rowsByContentId = new Map();
    values.slice(1).forEach((row, rowOffset) => {
      const contentId = normalize_(row[column['CONTENT ID']]);
      if (contentId) rowsByContentId.set(contentId, rowOffset + 2);
    });

    const files = DriveApp.getFolderById(PTAT_CONFIG.INTAKE_FOLDER_ID).getFiles();
    let updated = 0;

    while (files.hasNext()) {
      const file = files.next();
      const match = file.getName().match(PTAT_CONFIG.VIDEO_NAME);
      if (!match) continue;

      const contentId = match[1].toUpperCase();
      const rowNumber = rowsByContentId.get(contentId);
      if (!rowNumber) {
        console.log(`Ignored ${file.getName()}: no Content Queue row for ${contentId}.`);
        continue;
      }

      const row = values[rowNumber - 1];
      const autoStatus = normalize_(row[column['TRẠNG THÁI ĐĂNG TỰ ĐỘNG']]);
      const postingStatus = normalize_(row[column['TRẠNG THÁI ĐĂNG']]);

      // Preserve intentional human decisions and published history.
      if (autoStatus === 'BỎ QUA' || autoStatus === 'ĐÃ ĐĂNG' ||
          postingStatus === 'BỎ QUA' || postingStatus === 'ĐÃ ĐĂNG') {
        continue;
      }

      sheet.getRange(rowNumber, column['TRẠNG THÁI VIDEO'] + 1).setValue('VIDEO_READY');
      sheet.getRange(rowNumber, column['FILE VIDEO (DRIVE)'] + 1).setValue(file.getUrl());

      // A matching uploaded video is ready for the publishing queue.
      // Published and skipped rows already returned above and are never re-queued.
      const automaticStatusCell = sheet.getRange(
        rowNumber,
        column['TRẠNG THÁI ĐĂNG TỰ ĐỘNG'] + 1,
      );
      automaticStatusCell.setValue(
        allowedDropdownValue_(automaticStatusCell, 'SẴN SÀNG ĐĂNG'),
      );
      if (!postingStatus) {
        sheet.getRange(rowNumber, column['TRẠNG THÁI ĐĂNG'] + 1).setValue('CHƯA ĐĂNG');
      }

      updated += 1;
    }

    console.log(`Drive synchronization complete. Updated ${updated} queue row(s).`);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Publishes at most one eligible Reel per run, direct from Drive to Meta.
 * Eligible row: VIDEO_READY + SẴN SÀNG ĐĂNG + CHƯA ĐĂNG + non-empty caption.
 *
 * The Page token is read only from Script Properties. Never put it in code,
 * a sheet cell, a log, or a screenshot.
 */
function publishReadyReelToFacebook() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.log('Another publisher run is already active.');
    return;
  }

  try {
    const properties = PropertiesService.getScriptProperties();
    const token = properties.getProperty(PTAT_CONFIG.META_PAGE_ACCESS_TOKEN_PROPERTY);
    if (!token) throw new Error('Missing Page token in Script Properties.');

    const day = todayKey_();
    const daily = readDailyCount_(properties, day);
    if (daily.count >= PTAT_CONFIG.MAX_REELS_PER_DAY) {
      console.log(`Daily Reel limit reached for ${day}.`);
      return;
    }

    // Fail closed. If a prior run reached Meta but did not update the Sheet,
    // do not automatically retry and risk publishing the same Reel twice.
    if (properties.getProperty(PTAT_CONFIG.META_IN_FLIGHT_PROPERTY)) {
      console.warn('Publisher recovery lock exists. Verify the Page before clearing it manually.');
      return;
    }

    const sheet = SpreadsheetApp.openById(PTAT_CONFIG.SPREADSHEET_ID)
      .getSheetByName(PTAT_CONFIG.SHEET_NAME);
    if (!sheet) throw new Error(`Missing sheet: ${PTAT_CONFIG.SHEET_NAME}`);

    const values = sheet.getDataRange().getDisplayValues();
    if (values.length < 2) return;
    const column = indexHeaders_(values[0]);
    const candidate = findPublishCandidate_(values, column, day);
    if (!candidate) {
      console.log('No eligible Reel to publish.');
      return;
    }

    const file = DriveApp.getFileById(driveFileId_(candidate.driveUrl));
    const blob = file.getBlob().setName(file.getName());
    const fileSize = blob.getBytes().length;
    if (fileSize > PTAT_CONFIG.MAX_URLFETCH_FILE_BYTES) {
      markPostingStatus_(sheet, candidate.rowNumber, column, 'LỖI');
      throw new Error(`Video exceeds Apps Script's 50 MB URL Fetch POST limit: ${file.getName()}.`);
    }

    properties.setProperty(
      PTAT_CONFIG.META_IN_FLIGHT_PROPERTY,
      JSON.stringify({ contentId: candidate.contentId, rowNumber: candidate.rowNumber, startedAt: new Date().toISOString() }),
    );

    let metaPublishFinished = false;
    try {
      const started = metaFormPost_(
        `https://graph.facebook.com/${PTAT_CONFIG.META_GRAPH_VERSION}/me/video_reels`,
        { upload_phase: 'start' },
        token,
      );
      // Graph API returns raw fields; Make's HTTP module wraps them in data.
      const uploadUrl = started && (started.upload_url || started.data && started.data.upload_url);
      const videoId = started && (started.video_id || started.data && started.data.video_id);
      if (!uploadUrl || !videoId) throw new Error('Meta did not return a Reel upload session.');

      uploadReelBytes_(uploadUrl, token, blob, fileSize);
      metaFormPost_(
        `https://graph.facebook.com/${PTAT_CONFIG.META_GRAPH_VERSION}/me/video_reels`,
        {
          upload_phase: 'finish',
          video_id: videoId,
          video_state: 'PUBLISHED',
          description: candidate.caption,
          title: candidate.contentId,
        },
        token,
      );
      metaPublishFinished = true;

      markPostingStatus_(sheet, candidate.rowNumber, column, 'ĐÃ ĐĂNG');
      properties.setProperty(
        PTAT_CONFIG.META_DAILY_COUNT_PROPERTY,
        JSON.stringify({ day, count: daily.count + 1 }),
      );
      properties.deleteProperty(PTAT_CONFIG.META_IN_FLIGHT_PROPERTY);
      console.log(`Published ${candidate.contentId}; daily total: ${daily.count + 1}.`);
    } catch (error) {
      // Keep the recovery lock after every failure. A failed response can be
      // ambiguous, especially once Meta has received the publish request.
      // Human Page verification is required before clearing the lock.
      if (!metaPublishFinished) {
        try {
          markPostingStatus_(sheet, candidate.rowNumber, column, 'LỖI');
        } catch (statusError) {
          console.error('Could not mark the failed Reel row in the Sheet.');
        }
      }
      console.warn('Publisher stopped; recovery lock retained for manual Page verification.');
      throw error;
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * Safe configuration check: it makes no Meta request and never reveals the
 * token. Run this before creating the direct-publisher trigger.
 */
function validateDirectReelPublisherConfiguration() {
  const properties = PropertiesService.getScriptProperties();
  const hasToken = Boolean(properties.getProperty(PTAT_CONFIG.META_PAGE_ACCESS_TOKEN_PROPERTY));
  const sheet = SpreadsheetApp.openById(PTAT_CONFIG.SPREADSHEET_ID)
    .getSheetByName(PTAT_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`Missing sheet: ${PTAT_CONFIG.SHEET_NAME}`);

  const values = sheet.getDataRange().getDisplayValues();
  const column = indexHeaders_(values[0]);
  const candidate = findPublishCandidate_(values, column);
  console.log(JSON.stringify({
    tokenStored: hasToken,
    eligibleContentId: candidate ? candidate.contentId : null,
    publisherTriggerEnabled: ScriptApp.getProjectTriggers()
      .some((trigger) => trigger.getHandlerFunction() === PTAT_CONFIG.PUBLISH_HANDLER),
  }));
}

/**
 * Run only after checking the Facebook Page manually. It never publishes;
 * it solely removes the emergency lock left by an interrupted run.
 */
function clearDirectPublisherRecoveryLock() {
  PropertiesService.getScriptProperties()
    .deleteProperty(PTAT_CONFIG.META_IN_FLIGHT_PROPERTY);
}

function findPublishCandidate_(values, column, scheduledDay) {
  const targetDay = scheduledDay || todayKey_();
  for (let rowOffset = 1; rowOffset < values.length; rowOffset += 1) {
    const row = values[rowOffset];
    const isReady = normalize_(row[column['TRẠNG THÁI VIDEO']]) === 'VIDEO_READY';
    const isQueued = normalize_(row[column['TRẠNG THÁI ĐĂNG TỰ ĐỘNG']]) === 'SẴN SÀNG ĐĂNG';
    const isUnpublished = normalize_(row[column['TRẠNG THÁI ĐĂNG']]) === 'CHƯA ĐĂNG';
    const isScheduledToday = scheduledDateKey_(row[column['NGÀY ĐĂNG']]) === targetDay;
    const caption = String(row[column['CAPTION FACEBOOK']] || '').trim();
    const driveUrl = String(row[column['FILE VIDEO (DRIVE)']] || '').trim();
    if (!isReady || !isQueued || !isUnpublished || !isScheduledToday || !caption || !driveUrl) continue;

    return {
      rowNumber: rowOffset + 1,
      contentId: String(row[column['CONTENT ID']] || '').trim(),
      caption,
      driveUrl,
    };
  }
  return null;
}

function markPostingStatus_(sheet, rowNumber, column, status) {
  sheet.getRange(rowNumber, column['TRẠNG THÁI ĐĂNG'] + 1).setValue(status);
}

function readDailyCount_(properties, day) {
  const saved = JSON.parse(properties.getProperty(PTAT_CONFIG.META_DAILY_COUNT_PROPERTY) || '{}');
  return saved.day === day ? { day, count: Number(saved.count) || 0 } : { day, count: 0 };
}

function todayKey_() {
  return Utilities.formatDate(new Date(), PTAT_CONFIG.TIME_ZONE, 'yyyy-MM-dd');
}

function scheduledDateKey_(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function driveFileId_(url) {
  const pathMatch = String(url).match(/\/d\/([A-Za-z0-9_-]+)/);
  const queryMatch = String(url).match(/[?&]id=([A-Za-z0-9_-]+)/);
  const fileId = pathMatch && pathMatch[1] || queryMatch && queryMatch[1];
  if (!fileId) throw new Error('Could not read the Drive file ID from the queue row.');
  return fileId;
}

function metaFormPost_(endpoint, fields, token) {
  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    payload: Object.assign({}, fields, { access_token: token }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(metaResponseError_('Meta request', response));
  }
  try {
    return JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error('Meta returned an invalid JSON response.');
  }
}

function uploadReelBytes_(uploadUrl, token, blob, fileSize) {
  const response = UrlFetchApp.fetch(uploadUrl, {
    method: 'post',
    contentType: 'application/octet-stream',
    headers: {
      Authorization: `OAuth ${token}`,
      offset: '0',
      file_size: String(fileSize),
    },
    payload: blob,
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(metaResponseError_('Meta binary upload', response));
  }
}

function metaResponseError_(label, response) {
  const status = response.getResponseCode();
  try {
    const metaError = JSON.parse(response.getContentText()).error;
    if (metaError && typeof metaError === 'object') {
      const details = [
        metaError.type && `type=${metaError.type}`,
        metaError.code !== undefined && `code=${metaError.code}`,
        metaError.error_subcode !== undefined && `subcode=${metaError.error_subcode}`,
        metaError.message && `message=${String(metaError.message).replace(/\s+/g, ' ')}`,
      ].filter(Boolean).join('; ');
      if (details) return `${label} failed with HTTP ${status}: ${details}.`;
    }
  } catch (error) {
    // Keep only the HTTP status when Meta did not return a JSON error body.
  }
  return `${label} failed with HTTP ${status}.`;
}

function indexHeaders_(headers) {
  const positions = {};
  headers.forEach((header, index) => { positions[normalize_(header)] = index; });

  const missing = REQUIRED_HEADERS.filter((header) => positions[normalize_(header)] === undefined);
  if (missing.length) throw new Error(`Missing required column(s): ${missing.join(', ')}`);
  return positions;
}

function normalize_(value) {
  return String(value || '').normalize('NFC').trim().toUpperCase();
}

// Uses the Sheet's own dropdown text, preserving its exact Unicode characters.
function allowedDropdownValue_(cell, fallback) {
  const rule = cell.getDataValidation();
  if (!rule) return fallback;

  const source = rule.getCriteriaValues()[0];
  const values = Array.isArray(source)
    ? source
    : source && typeof source.getDisplayValues === 'function'
      ? source.getDisplayValues().flat()
      : [];

  return values.find((value) => normalize_(value) === normalize_(fallback)) || fallback;
}

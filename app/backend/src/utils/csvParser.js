const csv = require('csvtojson');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');

/**
 * Parse CSV file with automatic encoding detection and delimiter inference
 */
async function parseCSV(filePath, delimiter = ',') {
  try {
    const buffer = fs.readFileSync(filePath);
    let content;
    
    // Try UTF-8 first; if garbled (replacement chars), fall back to Latin-1
    const utf8 = buffer.toString('utf-8');
    if (utf8.includes('\uFFFD')) {
      content = iconv.decode(buffer, 'latin1');
    } else {
      content = utf8;
    }
    
    // Detect delimiter if needed
    let detectedDelimiter = delimiter;
    const firstLine = content.split('\n')[0];
    
    if (!firstLine.includes(delimiter)) {
      if (firstLine.includes(';')) {
        detectedDelimiter = ';';
      }
    }
    
    const data = await csv({
      delimiter: [',', ';', '\t'],
      checkType: true
    }).fromString(content);
    
    return data;
  } catch (error) {
    throw new Error(`Failed to parse CSV ${path.basename(filePath)}: ${error.message}`);
  }
}

/**
 * Normalize field names from CSV (handle special characters, spaces, etc.)
 */
function normalizeFieldName(fieldName) {
  return fieldName
    .toLowerCase()
    .replace(/[éèê]/g, 'e')
    .replace(/[àâ]/g, 'a')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùû]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[\s\-_./()]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Log import progress
 */
function logProgress(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const icons = {
    info: '•',
    success: '✓',
    warning: '⚠',
    error: '✗'
  };
  
  console.log(`[${timestamp}] ${icons[type] || '>'} ${message}`);
}

/**
 * Batch insert records with error handling
 */
async function batchInsert(connection, table, records, batchSize = 100) {
  const totalRecords = records.length;
  let successCount = 0;
  let failureCount = 0;
  const errors = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    for (const record of batch) {
      try {
        const fields = Object.keys(record);
        const values = Object.values(record);
        const placeholders = fields.map(() => '?').join(', ');
        
        const query = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`;
        await connection.execute(query, values);
        successCount++;
      } catch (error) {
        failureCount++;
        errors.push({
          record,
          error: error.message
        });
        
        // Log every 10th error to avoid spam
        if (failureCount % 10 === 0) {
          logProgress(`Processed ${successCount + failureCount}/${totalRecords} records`, 'warning');
        }
      }
    }
    
    if ((i + batchSize) % 500 === 0 || i + batchSize >= records.length) {
      logProgress(`Progress: ${Math.min(i + batchSize, totalRecords)}/${totalRecords}`, 'info');
    }
  }
  
  return {
    successCount,
    failureCount,
    errors: errors.slice(0, 10) // Return only first 10 errors
  };
}

/**
 * Stream parse large CSV files with automatic encoding detection
 * Processes records in chunks to avoid memory exhaustion
 */
async function parseCSVStream(filePath, onChunk, chunkSize = 1000) {
  return new Promise((resolve, reject) => {
    let chunkBuffer = [];
    let totalRecords = 0;
    let processing = Promise.resolve();

    csv({
      delimiter: [',', ';', '\t'],
      checkType: true
    })
      .fromFile(filePath)
      .on('data', (jsonObject) => {
        let record = jsonObject;

        // csvtojson emits Buffer/string from data events — parse to object
        if (Buffer.isBuffer(record)) {
          try {
            record = JSON.parse(record.toString());
          } catch (err) {
            return reject(new Error(`Failed to parse JSON chunk from CSV: ${err.message}`));
          }
        } else if (typeof record === 'string') {
          try {
            record = JSON.parse(record);
          } catch (err) {
            return reject(new Error(`Failed to parse JSON chunk from CSV: ${err.message}`));
          }
        }

        chunkBuffer.push(record);
        totalRecords++;

        if (chunkBuffer.length >= chunkSize) {
          const batch = chunkBuffer;
          chunkBuffer = [];
          processing = processing.then(() => onChunk(batch));
        }
      })
      .on('end', () => {
        if (chunkBuffer.length > 0) {
          processing = processing.then(() => onChunk(chunkBuffer));
        }

        processing
          .then(() => resolve(totalRecords))
          .catch(reject);
      })
      .on('error', (error) => {
        reject(new Error(`Failed to parse CSV ${path.basename(filePath)}: ${error.message}`));
      });
  });
}

module.exports = {
  parseCSV,
  parseCSVStream,
  normalizeFieldName,
  logProgress,
  batchInsert
};

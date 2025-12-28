// utils/parseFile.js
import csv from "csv-parser";
import xlsx from "xlsx";

const parseCSV = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = require("stream");
    const readable = new stream.Readable();
    readable.push(buffer);
    readable.push(null);

    readable
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
};

const parseExcel = (buffer) => {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet);
};

export { parseCSV, parseExcel };

import fs from "fs";
import { spawn } from "child_process";

const excludedFiles: string[] = [
  "executeTsScript.ts",
  "generate.ts",
  "template.ts",
];

fs.readdir(__dirname, (err, files) => {
  if (err) {
    console.error("Error reading the directory:", err);
    return;
  }

  files.forEach((file) => {
    if (file.endsWith(".ts") && !excludedFiles.includes(file)) {
      const process = spawn("ts-node", [file]);

      process.stdout.on("data", (data) => {
        console.log(`Output of ${file}:\n`, data.toString());
      });

      process.stderr.on("data", (data) => {
        console.error(`Error in ${file}:`, data.toString());
      });

      process.on("error", (err) => {
        console.error(`Error executing ${file}:`, err);
      });
    }
  });
});

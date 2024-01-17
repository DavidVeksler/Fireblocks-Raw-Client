import * as fs from "fs";

type ParsedLine = string[];

const CSV_SEPARATOR = "\n";
const FIELD_REGEX = /"(?:\\"|[^"])*"|[^,]+/g;
const DEFAULT_VAULT_VALUE = "defaultValue";

const readCsv = (file: string): string[] =>
  fs.readFileSync(file, "utf8").split(CSV_SEPARATOR).slice(1);

const parseCsvLine = (line: string): ParsedLine => {
  return (
    line.match(FIELD_REGEX)?.map((field) => field.replace(/^"|"$/g, "")) || []
  );
};

const loadMapFromCsv = (filePath: string): Map<string, string> => {
  const lines = readCsv(filePath);
  const map = new Map<string, string>();
  lines.forEach((line) => {
    const [key, value] = parseCsvLine(line);
    map.set(key, value);
  });
  return map;
};

const loadContractAndTokenMaps = (
  filePath: string
): [Map<string, string>, Map<string, string>] => {
  const lines = readCsv(filePath);
  const contractMap = new Map<string, string>();
  const tokenMap = new Map<string, string>();

  lines.forEach((line) => {
    const [coin, token, contract] = parseCsvLine(line);
    contractMap.set(coin, contract);
    tokenMap.set(coin, token);
  });

  return [contractMap, tokenMap];
};

const generateCode = (
  row: ParsedLine,
  template: string,
  contractMap: Map<string, string>,
  tokenMap: Map<string, string>,
  chainMap: Map<string, string>
): string | null => {
  const [coin, vault, amount, address, rownum, chain] = row;

  if (!address) return null;

  return template
    .replace("{coin}", coin)
    .replace(
      "{vault}",
      vault ? `${vault.split(",")[0]}'; // ${vault}` : DEFAULT_VAULT_VALUE
    )
    .replace("{amount}", amount.replace(/,/g, ""))
    .replace("{address}", address.trim())
    .replace("{contract}", contractMap.get(coin)?.trim() || "")
    .replace("{token}", tokenMap.get(coin)?.trim() || "")
    .replace("{rpcurl}", chainMap.get(chain)?.trim() || "")
    .replace("{chain}", chain)
    .replace("{rownum}", rownum);
};

const processRows = (
  rows: string[],
  template: string,
  contractMap: Map<string, string>,
  tokenMap: Map<string, string>,
  chainMap: Map<string, string>,
  lineNumber: number | null
): void => {
  rows.forEach((row, index) => {
    const parsedRow = parseCsvLine(row);
    const rownum = parseInt(parsedRow[4]);

    if (lineNumber !== null && rownum !== lineNumber) return;

    const code = generateCode(
      parsedRow,
      template,
      contractMap,
      tokenMap,
      chainMap
    );
    if (code) {
      const filename = `${rownum.toString().trim().replace(/\W+/g, "")}.ts`;
      fs.writeFileSync(filename, code, "utf8");
      console.log(filename);
    } else {
      console.error(
        `Skipping row ${index + 1} due to missing or malformed data.`
      );
    }
  });
};

// Main execution
try {
  const [contractMap, tokenMap] = loadContractAndTokenMaps("contracts.csv");
  const chainMap = loadMapFromCsv("chains.csv");
  const template = fs.readFileSync("template.ts", "utf8");
  const rows = readCsv("rows.csv");

  const lineNumber = process.argv[2] ? parseInt(process.argv[2]) : null;
  processRows(rows, template, contractMap, tokenMap, chainMap, lineNumber);

  console.log("Code generation completed.");
} catch (error) {
  console.error("An error occurred:", error);
}

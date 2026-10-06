const assert = require("assert");
const path = require("path");
const names = require("./versionedName");

const occupied = new Set();
const exists = (value) => occupied.has(path.normalize(value));
const dir = path.normalize("/documents");
const take = (name) => occupied.add(path.join(dir, name));

assert.equal(names.one(dir, "ГП.docx", exists), "ГП.docx");
take("ГП.docx");
assert.equal(names.one(dir, "ГП.docx", exists), "ГП (2).docx");
take("ГП (2).docx");
assert.equal(names.one(dir, "ГП.docx", exists), "ГП (3).docx");

take("Письмо.docx");
take("Письмо с приложением.docx");
take("Письмо (2).docx");
const pair = names.group(dir, ["Письмо.docx", "Письмо с приложением.docx"], exists);
assert.deepEqual(pair, ["Письмо (3).docx", "Письмо с приложением (3).docx"]);

console.log("Проверено версионное именование документов");

// В справочнике хранится именительный падеж, в ГП — «проведение ... экспертизы».
function forGuaranteeLetter(value) {
  return String(value || "").trim().toLocaleLowerCase("ru-RU")
    .replace(/ая(?=$|[\s,])/gu, "ой")
    .replace(/яя(?=$|[\s,])/gu, "ей");
}

module.exports = { forGuaranteeLetter };

/**
 * Склонение русских ФИО без внешнего сервиса.
 *
 * Документы содержат конфиденциальные данные, поэтому формы ФИО строятся
 * локально. Правила покрывают русские имена, отчества и фамилии, включая
 * женские формы, инициалы и составные фамилии через дефис. Иностранные и
 * заведомо несклоняемые фамилии остаются без изменений.
 */

const CASES = new Set(["nominative", "genitive", "dative", "accusative", "instrumental", "prepositional"]);
const MALE_A_NAMES = new Set(["илья", "никита", "кузьма", "лука", "фома", "данила", "савва"]);
const MALE_EXCEPTIONS = {
  пётр: { genitive: "Петра", dative: "Петру", accusative: "Петра", instrumental: "Петром", prepositional: "Петре" },
  петр: { genitive: "Петра", dative: "Петру", accusative: "Петра", instrumental: "Петром", prepositional: "Петре" },
  павел: { genitive: "Павла", dative: "Павлу", accusative: "Павла", instrumental: "Павлом", prepositional: "Павле" },
  лев: { genitive: "Льва", dative: "Льву", accusative: "Льва", instrumental: "Львом", prepositional: "Льве" },
};

function keepCase(source, replacement) {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function ending(word, remove, forms, gramCase) {
  const base = remove ? word.slice(0, -remove) : word;
  return base + forms[gramCase];
}

function detectGender(parts) {
  const patronymic = String(parts[2] || "").toLowerCase().replace(/[.\s-]/g, "");
  if (/(овна|евна|ична|инична)$/.test(patronymic)) return "female";
  if (/(ович|евич|ич)$/.test(patronymic)) return "male";
  const name = String(parts[1] || "").toLowerCase().replace(/[.\s-]/g, "");
  if (MALE_A_NAMES.has(name) || MALE_EXCEPTIONS[name]) return "male";
  if (/[аяь]$/.test(name)) return "female";
  const surname = String(parts[0] || "").toLowerCase();
  if (/(ова|ева|ёва|ина|ына|ская|цкая|ая|яя)$/.test(surname)) return "female";
  return "male";
}

function isInitials(word) {
  return /^(?:[А-ЯЁA-Z]\.){1,3}$/i.test(word);
}

function declineFemale(word, gramCase, role) {
  const lower = word.toLowerCase();
  if (role === "surname" && !/[ая]$/.test(lower)) return word;
  if (/(ова|ева|ёва|ина|ына)$/.test(lower) && role === "surname") {
    return ending(word, 1, { genitive: "ой", dative: "ой", accusative: "у", instrumental: "ой", prepositional: "ой" }, gramCase);
  }
  if (/(ская|цкая|ая)$/.test(lower) && role === "surname") {
    return ending(word, 2, { genitive: "ой", dative: "ой", accusative: "ую", instrumental: "ой", prepositional: "ой" }, gramCase);
  }
  if (/яя$/.test(lower) && role === "surname") {
    return ending(word, 2, { genitive: "ей", dative: "ей", accusative: "юю", instrumental: "ей", prepositional: "ей" }, gramCase);
  }
  if (/ия$/.test(lower)) {
    return ending(word, 2, { genitive: "ии", dative: "ии", accusative: "ию", instrumental: "ией", prepositional: "ии" }, gramCase);
  }
  if (/ья$/.test(lower)) {
    return ending(word, 2, { genitive: "ьи", dative: "ье", accusative: "ью", instrumental: "ьей", prepositional: "ье" }, gramCase);
  }
  if (/а$/.test(lower)) {
    const gen = /[гкхжчшщц]а$/.test(lower) ? "и" : "ы";
    return ending(word, 1, { genitive: gen, dative: "е", accusative: "у", instrumental: "ой", prepositional: "е" }, gramCase);
  }
  if (/я$/.test(lower)) {
    return ending(word, 1, { genitive: "и", dative: "е", accusative: "ю", instrumental: "ей", prepositional: "е" }, gramCase);
  }
  if (/ь$/.test(lower) && role !== "surname") {
    return ending(word, 1, { genitive: "и", dative: "и", accusative: "ь", instrumental: "ью", prepositional: "и" }, gramCase);
  }
  return word;
}

function declineMale(word, gramCase, role) {
  const lower = word.toLowerCase();
  if (role === "name" && MALE_EXCEPTIONS[lower]?.[gramCase]) {
    return keepCase(word, MALE_EXCEPTIONS[lower][gramCase]);
  }
  // Несклоняемые русские и иностранные фамилии.
  if (role === "surname" && /(ых|их|аго|ово|енко|ко|иа|уа|о|е|э|и|ы|у|ю)$/.test(lower)) return word;
  if (role === "surname" && /(ов|ев|ёв|ин|ын)$/.test(lower)) {
    return ending(word, 0, { genitive: "а", dative: "у", accusative: "а", instrumental: "ым", prepositional: "е" }, gramCase);
  }
  if (role === "patronymic" && /ич$/.test(lower)) {
    return ending(word, 0, { genitive: "а", dative: "у", accusative: "а", instrumental: "ем", prepositional: "е" }, gramCase);
  }
  if (role === "surname" && /(ский|цкий|ый)$/.test(lower)) {
    return ending(word, 2, { genitive: "ого", dative: "ому", accusative: "ого", instrumental: "ым", prepositional: "ом" }, gramCase);
  }
  if (role === "surname" && /ой$/.test(lower)) {
    return ending(word, 2, { genitive: "ого", dative: "ому", accusative: "ого", instrumental: "ым", prepositional: "ом" }, gramCase);
  }
  if (role === "surname" && /ий$/.test(lower)) {
    return ending(word, 2, { genitive: "его", dative: "ему", accusative: "его", instrumental: "им", prepositional: "ем" }, gramCase);
  }
  if (/ия$/.test(lower)) {
    return ending(word, 2, { genitive: "ия", dative: "ию", accusative: "ия", instrumental: "ием", prepositional: "ии" }, gramCase);
  }
  if (/ий$/.test(lower)) {
    return ending(word, 1, { genitive: "я", dative: "ю", accusative: "я", instrumental: "ем", prepositional: "и" }, gramCase);
  }
  if (/й$/.test(lower)) {
    return ending(word, 1, { genitive: "я", dative: "ю", accusative: "я", instrumental: "ем", prepositional: "е" }, gramCase);
  }
  if (/ь$/.test(lower)) {
    return ending(word, 1, { genitive: "я", dative: "ю", accusative: "я", instrumental: "ем", prepositional: "е" }, gramCase);
  }
  if (/[ая]$/.test(lower)) {
    return declineFemale(word, gramCase, role);
  }
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(lower)) {
    return ending(word, 0, { genitive: "а", dative: "у", accusative: "а", instrumental: "ом", prepositional: "е" }, gramCase);
  }
  return word;
}

function declinePart(word, gramCase, role, gender) {
  if (!word || isInitials(word) || !/[А-ЯЁа-яё]/.test(word)) return word;
  return word.split("-").map((piece) =>
    gender === "female" ? declineFemale(piece, gramCase, role) : declineMale(piece, gramCase, role)
  ).join("-");
}

function declineFullName(raw, gramCase, options = {}) {
  const clean = String(raw || "").replace(/\s+/g, " ").trim();
  if (!clean || gramCase === "nominative") return clean;
  if (!CASES.has(gramCase)) throw new Error(`Неизвестный падеж ФИО: ${gramCase}`);
  const parts = clean.split(" ");
  const gender = options.gender || detectGender(parts);
  return parts.map((part, index) => declinePart(
    part, gramCase, index === 0 ? "surname" : index === 1 ? "name" : "patronymic", gender
  )).join(" ");
}

function declineFullNames(names, gramCase) {
  const values = (names || []).map((name) => declineFullName(name, gramCase)).filter(Boolean);
  if (values.length < 2) return values[0] || "";
  return `${values.slice(0, -1).join(", ")} и ${values[values.length - 1]}`;
}

function countForm(raw, one, few, many) {
  const value = Math.abs(Math.trunc(Number(String(raw ?? "0").replace(/[\s\u00a0]+/g, "").replace(",", ".")) || 0));
  const last100 = value % 100;
  const last10 = value % 10;
  if (last100 >= 11 && last100 <= 19) return many;
  if (last10 === 1) return one;
  if (last10 >= 2 && last10 <= 4) return few;
  return many;
}

module.exports = { declineFullName, declineFullNames, detectGender, countForm };

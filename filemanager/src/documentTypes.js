const TYPES = {
  contract_research: {
    id: "contract_research", title: "Договор на независимое исследование",
    shortTitle: "Договор", templateFile: "contract-research.docx", group: "main",
    folder: "planning-contract", filePrefix: "Договор на независимое исследование",
    fields: [
      ["contractDate", "Дата договора", "date", true],
      ["customerIntro", "Полное наименование заказчика", "textarea", true],
      ["customerRepresentative", "Представитель заказчика (ФИО)", "text", true],
      ["customerPosition", "Должность представителя", "text", true],
      ["customerAuthority", "Действует на основании", "text", true],
      ["workSubject", "Предмет работ", "textarea", true],
      ["questions", "Вопросы исследования", "list", true],
      ["termText", "Срок выполнения", "text", true, "20 рабочих дней"],
      ["costAmount", "Стоимость, руб.", "number", true],
      ["vatPercent", "НДС, %", "number", true, "20"],
      ["prepaymentPercent", "Предоплата, %", "number", true, "100"],
      ["travelClause", "Условие о командировочных расходах", "textarea", true,
        "Командировочные расходы экспертов оплачиваются Заказчиком по фактическим расходам, подтвержденным документами."],
      ["customerShortName", "Краткое наименование", "text", true],
      ["legalAddress", "Юридический адрес", "text"], ["actualAddress", "Фактический адрес", "text"],
      ["innKpp", "ИНН, КПП", "text"], ["ogrn", "ОГРН", "text"],
      ["paymentAccount", "Расчётный счёт", "text"], ["correspondentAccount", "Корреспондентский счёт", "text"],
      ["bik", "БИК", "text"], ["phone", "Телефон/факс", "text"], ["email", "E-mail", "text"],
      ["customerInitials", "Подпись заказчика (инициалы и фамилия)", "text", true],
    ],
  },
  refusal: {
    id: "refusal", title: "Отказное письмо", shortTitle: "Отказное письмо",
    templateFile: "refusal.docx", group: "main", folder: "planning-correspondence", filePrefix: "Отказное письмо",
    allowNewProject: true,
    fields: [
      ["recipientOrganization", "Организация получателя", "text", true],
      ["recipientPerson", "Получатель: должность и ФИО", "text", true],
      ["recipientGreeting", "Имя и отчество для обращения (без «Уважаемый»)", "text", true],
      ["caseNumber", "Номер дела / запроса", "text", true],
      ["expertiseType", "Вид экспертизы", "text", true],
      ["executorName", "Исполнитель", "text", true],
      ["executorExtension", "Добавочный телефон", "text", true],
    ],
  },
  stitch: {
    id: "stitch", title: "Карточки «Прошито и пронумеровано»", shortTitle: "Прошито и пронумеровано",
    templateFile: "stitch.docx", group: "main", folder: "conclusion", filePrefix: "Прошито и пронумеровано",
    fields: [
      ["sheetCount", "Количество листов", "number", true],
      ["cardCount", "Количество карточек", "number", true, "2"],
      ["signer1", "Подписант 1", "text", true, "П.А. Воровкин"],
      ["signer2", "Подписант 2", "text", false],
    ],
  },
  petition_replace_expert: {
    id: "petition_replace_expert", title: "Ходатайство о замене эксперта", shortTitle: "О замене эксперта",
    templateFile: "petition-replace-expert.docx", group: "petition", folder: "petitions", filePrefix: "Ходатайство о замене эксперта",
    fields: petitionCommon([
      ["removedExpertShort", "Исключаемый эксперт (из базы)", "expert-single", true],
      ["expertPaths", "Добавляемые эксперты (из базы)", "expert-multi", true],
      ["applications", "Перечень приложений", "list", true,
        ["Сведения об экспертах.", "Приказ о прекращении трудового договора с работником."]],
      ["attachments", "Приказ об увольнении (сканы)", "files", true],
    ]),
  },
  petition_inspection: {
    id: "petition_inspection", title: "Ходатайство о проведении экспертного осмотра", shortTitle: "О проведении осмотра",
    templateFile: "petition-inspection.docx", group: "petition", folder: "petitions", filePrefix: "Ходатайство о проведении осмотра",
    fields: petitionCommon([
      ["additionalMaterialsIntro", "Вводная фраза о материалах", "textarea"],
      ["materials", "Полученные материалы", "list"],
      ["inspectionKind", "Вид осмотра", "text", true, "повторного"],
      ["inspectionDetails", "Дата, время и адрес осмотра", "textarea", true],
    ]),
  },
  petition_extension: {
    id: "petition_extension", title: "Ходатайство о продлении срока экспертизы", shortTitle: "О продлении срока",
    templateFile: "petition-extension.docx", group: "petition", folder: "petitions", filePrefix: "Ходатайство о продлении срока",
    fields: petitionCommon([
      ["extensionReason", "Причина продления", "textarea", true],
      ["extensionDays", "Количество рабочих дней", "number", true],
      ["extensionFrom", "От какой даты / события считать срок", "text", true],
    ]),
  },
  petition_expand_experts: {
    id: "petition_expand_experts", title: "Ходатайство о расширении группы экспертов", shortTitle: "О расширении группы экспертов",
    templateFile: "petition-expand-experts.docx", group: "petition", folder: "petitions", filePrefix: "Ходатайство о расширении группы экспертов",
    fields: petitionCommon([
      ["expansionBasis", "Основание расширения группы", "textarea", true],
      ["expertPaths", "Добавляемые эксперты (из базы)", "expert-multi", true],
      ["applications", "Перечень приложений", "list", true, ["Сведения об экспертах."]],
    ]),
  },
  petition_request_evidence: {
    id: "petition_request_evidence", title: "Ходатайство об истребовании доказательств", shortTitle: "Об истребовании доказательств",
    templateFile: "petition-request-evidence.docx", group: "petition", folder: "petitions", filePrefix: "Ходатайство об истребовании доказательств",
    fields: petitionCommon([["materials", "Истребуемые материалы", "list", true]]),
  },
  petition_review_questions: {
    id: "petition_review_questions", title: "Ходатайство об ознакомлении с вопросами", shortTitle: "Об ознакомлении с вопросами",
    templateFile: "petition-review-questions.docx", group: "petition", folder: "petitions", filePrefix: "Ходатайство об ознакомлении с вопросами",
    fields: petitionCommon([
      ["courtGenitive", "Суд в родительном падеже", "text", true],
      ["judgeGenitive", "Судья в родительном падеже", "text", true],
      ["orderDate", "Дата определения", "date", true],
      ["questionsDueDate", "Дата предоставления вопросов", "date", true],
    ], false),
  },
  petition_video_hearing: {
    id: "petition_video_hearing", title: "Ходатайство об участии в заседании по веб-конференции", shortTitle: "Об участии по веб-конференции",
    templateFile: "petition-video-hearing.docx", group: "petition", folder: "petitions", filePrefix: "Ходатайство о веб-конференции",
    fields: petitionCommon([
      ["courtGenitive", "Суд в родительном падеже", "text", true],
      ["judgeGenitive", "Судья в родительном падеже", "text", true],
      ["orderDate", "Дата определения", "date", true],
      ["calledExpertDative", "Вызываемый эксперт (кому)", "text", true, "Воровкину Павлу Александровичу"],
      ["hearingDate", "Дата заседания", "date", true],
      ["hearingHour", "Часы", "number", true], ["hearingMinute", "Минуты", "number", true, "00"],
    ], false),
  },
};

function petitionCommon(extra, includeOrder = true) {
  const common = [
    ["court", "Суд", "text", true], ["caseNumber", "Номер дела", "text", true],
    ["judge", "Судья", "text", true],
  ];
  if (includeOrder) common.push(["orderReference", "Ссылка на определение суда", "textarea", true]);
  return common.concat(extra);
}

function get(raw) {
  const type = TYPES[String(raw || "")];
  if (!type) { const err = new Error("Неизвестный вид документа"); err.status = 404; throw err; }
  return type;
}

function publicCatalog() {
  return Object.values(TYPES).map(({ templateFile, folder, filePrefix, ...item }) => item);
}

module.exports = { TYPES, get, publicCatalog };

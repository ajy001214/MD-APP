const STORAGE_KEY = "MD_SCHOLARSHIP_DATA_RUNTIME";
const SPREADSHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

let data = loadInitialData();
let selectedStudentId = null;
const expandedOverviewSections = new Set();

const defaultRules = {
  minimumSubjects: 3,
  tierOnePoint: 4.0,
  tierOneAmount: 1000000,
  tierTwoPoint: 3.5,
  tierTwoAmount: 700000,
  tierThreePoint: 3.0,
  tierThreeAmount: 500000,
};

const ruleFields = {
  minimumSubjects: document.getElementById("minimumSubjects"),
  tierOnePoint: document.getElementById("tierOnePoint"),
  tierOneAmount: document.getElementById("tierOneAmount"),
  tierTwoPoint: document.getElementById("tierTwoPoint"),
  tierTwoAmount: document.getElementById("tierTwoAmount"),
  tierThreePoint: document.getElementById("tierThreePoint"),
  tierThreeAmount: document.getElementById("tierThreeAmount"),
};

const activeProcessStat = document.getElementById("activeProcessStat");
const recordCountStat = document.getElementById("recordCountStat");
const eligibleCountStat = document.getElementById("eligibleCountStat");
const uniqueStudentStat = document.getElementById("uniqueStudentStat");
const processTagList = document.getElementById("processTagList");
const noteList = document.getElementById("noteList");
const studentSearchInput = document.getElementById("studentSearchInput");
const processFilter = document.getElementById("processFilter");
const tierFilter = document.getElementById("tierFilter");
const awardedCountStat = document.getElementById("awardedCountStat");
const budgetStat = document.getElementById("budgetStat");
const averagePointStat = document.getElementById("averagePointStat");
const resultsTableBody = document.getElementById("resultsTableBody");
const summaryTableBody = document.getElementById("summaryTableBody");
const dataSourceText = document.getElementById("dataSourceText");
const importStatusText = document.getElementById("importStatusText");
const reloadWorkbookButton = document.getElementById("reloadWorkbookButton");
const workbookFileInput = document.getElementById("workbookFileInput");
const studentDetailContent = document.getElementById("studentDetailContent");
const studentDetailModal = document.getElementById("studentDetailModal");
const closeStudentDetailButton = document.getElementById("closeStudentDetailButton");

document.getElementById("recalculateButton").addEventListener("click", renderResults);
document.getElementById("resetRuleButton").addEventListener("click", () => {
  applyDefaultRules();
  renderResults();
});
reloadWorkbookButton.addEventListener("click", () => {
  workbookFileInput.value = "";
  workbookFileInput.click();
});
workbookFileInput.addEventListener("change", handleWorkbookSelection);
studentSearchInput.addEventListener("input", renderResults);
processFilter.addEventListener("change", renderResults);
tierFilter.addEventListener("change", renderResults);
resultsTableBody.addEventListener("click", handleResultsTableClick);
summaryTableBody.addEventListener("click", handleOverviewToggleClick);
closeStudentDetailButton.addEventListener("click", closeStudentDetailModal);
studentDetailModal.addEventListener("click", (event) => {
  if (event.target === studentDetailModal) {
    closeStudentDetailModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !studentDetailModal.hidden) {
    closeStudentDetailModal();
  }
});

initialize();

function initialize() {
  applyDefaultRules();
  renderWorkbookInsight();
  renderProcessFilter();
  renderTierFilter();
  renderResults();
  renderStudentDetail();
}

function loadInitialData() {
  const bundledData = normalizeLoadedData(window.MD_SCHOLARSHIP_DATA);
  const stored = readStoredData();

  if (stored) {
    try {
      return mergeDataSources(bundledData, normalizeLoadedData(JSON.parse(stored)));
    } catch {
      clearStoredData();
    }
  }

  return bundledData;
}

function applyDefaultRules() {
  Object.entries(defaultRules).forEach(([key, value]) => {
    ruleFields[key].value = value;
  });
}

function getRules() {
  return {
    minimumSubjects: Number(ruleFields.minimumSubjects.value),
    tierOnePoint: Number(ruleFields.tierOnePoint.value),
    tierOneAmount: Number(ruleFields.tierOneAmount.value),
    tierTwoPoint: Number(ruleFields.tierTwoPoint.value),
    tierTwoAmount: Number(ruleFields.tierTwoAmount.value),
    tierThreePoint: Number(ruleFields.tierThreePoint.value),
    tierThreeAmount: Number(ruleFields.tierThreeAmount.value),
  };
}

function renderWorkbookInsight() {
  activeProcessStat.textContent = `${data.metadata.activeProcessCount}개`;
  recordCountStat.textContent = `${data.stats.totalRecords.toLocaleString("ko-KR")}건`;
  eligibleCountStat.textContent = `${data.stats.eligibleRecords.toLocaleString("ko-KR")}건`;
  uniqueStudentStat.textContent = `${data.stats.uniqueStudents.toLocaleString("ko-KR")}명`;

  renderWorkbookSummaryTable();

  processTagList.innerHTML = "";
  data.metadata.activeProcesses.forEach((processName) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = normalizeProcessName(processName);
    processTagList.appendChild(tag);
  });

  noteList.innerHTML = "";
  noteList.hidden = true;

  dataSourceText.textContent = `학습 파일: ${data.metadata.sourceFile} / 생성 시각: ${data.metadata.generatedAt}`;
}

function renderWorkbookSummaryTable() {
  const overviewRows = normalizeArray(data.metadata.workbookOverview?.rows);
  if (overviewRows.length > 0) {
    summaryTableBody.innerHTML = "";
    renderOverviewSections(overviewRows);

    return;
  }

  const summaryRows = normalizeArray(data.metadata.workbookSummary);
  summaryTableBody.innerHTML = "";

  if (summaryRows.length === 0) {
    summaryTableBody.innerHTML = '<tr class="empty-row"><td colspan="6">맨 앞 시트 표가 없습니다.</td></tr>';
    return;
  }

  summaryRows.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(item.category || "-")}</td>
      <td>${escapeHtml(normalizeProcessName(item.processName || "-"))}</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td>${formatTableCount(item.threeOrMoreCount)}</td>
    `;
    summaryTableBody.appendChild(row);
  });
}

function formatTableCount(value) {
  if (typeof value === "number") {
    return value.toLocaleString("ko-KR");
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed.toLocaleString("ko-KR");
  }

  return "-";
}

function renderOverviewSections(overviewRows) {
  const sections = buildOverviewSections(overviewRows);

  sections.forEach((section) => {
    if (section.collapsible) {
      const sectionRow = document.createElement("tr");
      sectionRow.className = "overview-section-row";
      sectionRow.innerHTML = `
        <td colspan="6">
          <button
            type="button"
            class="overview-toggle"
            data-overview-section="${escapeHtml(section.key)}"
            aria-expanded="${expandedOverviewSections.has(section.key)}"
          >
            <span class="overview-arrow">${expandedOverviewSections.has(section.key) ? "▾" : "▸"}</span>
            <span>${escapeHtml(section.title)}</span>
          </button>
        </td>
      `;
      summaryTableBody.appendChild(sectionRow);
    }

    const shouldShowRows = !section.collapsible || expandedOverviewSections.has(section.key);
    if (!shouldShowRows) {
      return;
    }

    section.rows.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(item.category || "")}</td>
        <td>${escapeHtml(normalizeProcessName(item.division || ""))}</td>
        <td>${formatTableCount(item.totalCount)}</td>
        <td>${formatTableCount(item.oneSubjectCount)}</td>
        <td>${formatTableCount(item.twoSubjectCount)}</td>
        <td>${formatTableCount(item.threeOrMoreCount)}</td>
      `;
      summaryTableBody.appendChild(row);
    });
  });
}

function buildOverviewSections(rows) {
  const sections = [];
  let currentSection = null;

  rows.forEach((item) => {
    const category = item.category || "";

    if (category && category !== "합계") {
      currentSection = {
        key: category,
        title: category,
        collapsible: true,
        rows: [],
      };
      sections.push(currentSection);
    }

    if (category === "합계") {
      currentSection = {
        key: "합계",
        title: "합계",
        collapsible: false,
        rows: [],
      };
      sections.push(currentSection);
    }

    if (!currentSection) {
      currentSection = {
        key: "기타",
        title: "기타",
        collapsible: false,
        rows: [],
      };
      sections.push(currentSection);
    }

    currentSection.rows.push(item);
  });

  return sections;
}

function renderProcessFilter() {
  const currentValue = processFilter.value;
  const options = ["전체", ...data.metadata.activeProcesses];
  processFilter.innerHTML = "";

  options.forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = normalizeProcessName(label);
    processFilter.appendChild(option);
  });

  processFilter.value = options.includes(currentValue) ? currentValue : "전체";
}

function renderTierFilter() {
  const currentValue = tierFilter.value;
  const options = ["전체", "1구간", "2구간", "3구간", "미지급"];
  tierFilter.innerHTML = "";

  options.forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    tierFilter.appendChild(option);
  });

  tierFilter.value = options.includes(currentValue) ? currentValue : "전체";
}

function renderResults() {
  const filteredResults = getEvaluatedFilteredResults();

  resultsTableBody.innerHTML = "";

  if (filteredResults.length === 0) {
    resultsTableBody.innerHTML = '<tr class="empty-row"><td colspan="8">표시할 결과가 없습니다.</td></tr>';
    updateResultStats([]);
    if (selectedStudentId && !findStudentById(selectedStudentId)) {
      selectedStudentId = null;
    }
    renderStudentDetail();
    return;
  }

  filteredResults.forEach((result) => {
    const row = document.createElement("tr");
    row.dataset.studentId = result.studentId;
    if (selectedStudentId === result.studentId) {
      row.classList.add("selected-student-row");
    }
    row.innerHTML = `
      <td><button type="button" class="student-link" data-student-id="${escapeHtml(result.studentId)}">${escapeHtml(result.name)}(${escapeHtml(result.studentId)})</button></td>
      <td>${escapeHtml(result.department || "-")}</td>
      <td>${escapeHtml(normalizeProcessName(result.processName))}</td>
      <td>${result.subjectCount}과목</td>
      <td>${result.averagePoint !== null ? result.averagePoint.toFixed(2) : "-"}</td>
      <td>${createBadge(result.tierLabel, result.tierVariant)}</td>
      <td>${formatCurrency(result.amount)}</td>
      <td>${createSubjectList(result.subjects)}</td>
    `;
    resultsTableBody.appendChild(row);
  });

  updateResultStats(filteredResults);

  if (selectedStudentId && !findStudentById(selectedStudentId)) {
    selectedStudentId = null;
  }

  renderStudentDetail();
}

function evaluateScholarship(record, rules) {
  const meetsSubjectRule = record.subjectCount >= rules.minimumSubjects;
  const hasCompleteGrades = record.subjectCount > 0 && record.gradedSubjectCount === record.subjectCount;
  const meetsGradeRule = meetsSubjectRule && hasCompleteGrades;
  const averagePoint = typeof record.averagePoint === "number" ? record.averagePoint : null;

  let tierLabel = "미지급";
  let tierVariant = "none";
  let amount = 0;

  if (meetsGradeRule && averagePoint !== null) {
    if (averagePoint >= rules.tierOnePoint) {
      tierLabel = "1구간";
      tierVariant = "tier-one";
      amount = rules.tierOneAmount;
    } else if (averagePoint >= rules.tierTwoPoint) {
      tierLabel = "2구간";
      tierVariant = "tier-two";
      amount = rules.tierTwoAmount;
    } else if (averagePoint >= rules.tierThreePoint) {
      tierLabel = "3구간";
      tierVariant = "tier-three";
      amount = rules.tierThreeAmount;
    }
  }

  return {
    ...record,
    meetsSubjectRule,
    hasCompleteGrades,
    meetsGradeRule,
    averagePoint,
    tierLabel,
    tierVariant,
    amount,
  };
}

function updateResultStats(results) {
  const awarded = results.filter((item) => item.amount > 0);
  const totalBudget = awarded.reduce((sum, item) => sum + item.amount, 0);
  const averagePointValues = awarded
    .map((item) => item.averagePoint)
    .filter((value) => typeof value === "number");
  const averagePoint = averagePointValues.length > 0
    ? averagePointValues.reduce((sum, value) => sum + value, 0) / averagePointValues.length
    : 0;

  awardedCountStat.textContent = `${awarded.length.toLocaleString("ko-KR")}건`;
  budgetStat.textContent = formatCurrency(totalBudget);
  averagePointStat.textContent = averagePoint.toFixed(2);
}

function createBadge(label, variant) {
  return `<span class="badge ${variant}">${label}</span>`;
}

function createSubjectList(subjects) {
  const normalizedSubjects = normalizeArray(subjects);
  const listItems = normalizedSubjects.map((subject) => {
    const grade = subject.grade || "성적 없음";
    return `<li class="subject-item"><span>${escapeHtml(subject.name)}</span><strong>${escapeHtml(grade)}</strong></li>`;
  }).join("");

  return `<ul class="subject-list">${listItems}</ul>`;
}

function formatCurrency(amount) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function normalizeProcessName(processName) {
  if (processName === "珥덇툒") {
    return "초급";
  }

  return processName;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function handleWorkbookSelection(event) {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  setImportStatus("엑셀 파일을 읽는 중입니다...", "busy");
  reloadWorkbookButton.disabled = true;

  try {
    const imported = await buildDataFromWorkbook(file);
    data = normalizeLoadedData(imported);
    writeStoredData(JSON.stringify(imported));
    renderWorkbookInsight();
    renderProcessFilter();
    renderTierFilter();
    renderResults();
    setImportStatus(`"${file.name}" 변경분을 반영했습니다.`, "success");
  } catch (error) {
    console.error(error);
    setImportStatus("엑셀 반영에 실패했습니다. 파일 형식과 시트 구성을 확인해 주세요.", "error");
  } finally {
    reloadWorkbookButton.disabled = false;
  }
}

function setImportStatus(message, variant) {
  importStatusText.textContent = message;
  importStatusText.classList.remove("status-busy", "status-error", "status-success");

  if (variant) {
    importStatusText.classList.add(`status-${variant}`);
  }
}

function getEvaluatedFilteredResults() {
  const rules = getRules();
  const searchKeyword = studentSearchInput.value.trim();

  return data.records
    .map((record) => evaluateScholarship(record, rules))
    .filter((record) => {
      const searchMatches =
        !searchKeyword ||
        record.name.includes(searchKeyword) ||
        record.studentId.includes(searchKeyword);
      const processMatches =
        processFilter.value === "전체" ||
        !processFilter.value ||
        record.processName === processFilter.value;
      const tierMatches =
        tierFilter.value === "전체" ||
        !tierFilter.value ||
        record.tierLabel === tierFilter.value;

      return searchMatches && processMatches && tierMatches;
    })
    .sort((left, right) => {
      if (left.studentId !== right.studentId) {
        return left.studentId.localeCompare(right.studentId, "ko-KR");
      }

      if (right.amount !== left.amount) {
        return right.amount - left.amount;
      }

      return normalizeProcessName(left.processName).localeCompare(normalizeProcessName(right.processName), "ko-KR");
    });
}

function getEvaluatedAllResults() {
  const rules = getRules();

  return data.records
    .map((record) => evaluateScholarship(record, rules))
    .sort((left, right) => {
      if (left.studentId !== right.studentId) {
        return left.studentId.localeCompare(right.studentId, "ko-KR");
      }

      if (right.amount !== left.amount) {
        return right.amount - left.amount;
      }

      return normalizeProcessName(left.processName).localeCompare(normalizeProcessName(right.processName), "ko-KR");
    });
}

function handleResultsTableClick(event) {
  const button = event.target.closest("[data-student-id]");
  if (!button) {
    return;
  }

  selectedStudentId = button.dataset.studentId;
  renderStudentDetail();
  highlightSelectedStudentRows();
  openStudentDetailModal();
}

function handleOverviewToggleClick(event) {
  const button = event.target.closest("[data-overview-section]");
  if (!button) {
    return;
  }

  const sectionKey = button.dataset.overviewSection;
  if (expandedOverviewSections.has(sectionKey)) {
    expandedOverviewSections.delete(sectionKey);
  } else {
    expandedOverviewSections.add(sectionKey);
  }

  renderWorkbookSummaryTable();
}

function findStudentById(studentId) {
  return getEvaluatedAllResults().find((record) => record.studentId === studentId) ?? null;
}

function renderStudentDetail() {
  if (!selectedStudentId) {
    studentDetailContent.className = "student-detail-empty";
    studentDetailContent.innerHTML = "학번을 누르면 해당 학생의 전체 장학금 산정 내역이 여기에 표시됩니다.";
    return;
  }

  const studentRecords = getEvaluatedAllResults().filter((record) => record.studentId === selectedStudentId);
  if (studentRecords.length === 0) {
    studentDetailContent.className = "student-detail-empty";
    studentDetailContent.innerHTML = "선택한 학생의 장학금 산정 내역이 없습니다.";
    return;
  }

  const primaryRecord = studentRecords[0];
  const totalAward = studentRecords.reduce((sum, record) => sum + record.amount, 0);
  const awardedCount = studentRecords.filter((record) => record.amount > 0).length;
  const processItems = studentRecords.map((record) => `
    <article class="student-process-card">
      <div class="student-process-header">
        <strong>${escapeHtml(normalizeProcessName(record.processName))}</strong>
        ${createBadge(record.tierLabel, record.tierVariant)}
      </div>
      <div class="student-process-meta">
        <span>이수 과목 수 ${record.subjectCount}과목</span>
        <span>성적 반영 ${record.gradedSubjectCount}/${record.subjectCount}</span>
        <span>평균 평점 ${record.averagePoint !== null ? record.averagePoint.toFixed(2) : "-"}</span>
        <span>예상 금액 ${formatCurrency(record.amount)}</span>
      </div>
      <div class="student-process-subjects">${createSubjectList(record.subjects)}</div>
    </article>
  `).join("");

  studentDetailContent.className = "student-detail";
  studentDetailContent.innerHTML = `
    <div class="student-summary-card">
      <div>
        <p class="student-summary-kicker">학생 기본 정보</p>
        <h3>${escapeHtml(primaryRecord.name)}<span>${escapeHtml(primaryRecord.studentId)}</span></h3>
        <p class="student-summary-meta">${escapeHtml(primaryRecord.department || "-")} / ${escapeHtml(primaryRecord.year || "-")}학년</p>
      </div>
      <div class="student-summary-stats">
        <div><span>전체 과정 수</span><strong>${studentRecords.length}건</strong></div>
        <div><span>지급 건수</span><strong>${awardedCount}건</strong></div>
        <div><span>총 예상 금액</span><strong>${formatCurrency(totalAward)}</strong></div>
      </div>
    </div>
    <div class="student-process-list">
      ${processItems}
    </div>
  `;
}

function openStudentDetailModal() {
  studentDetailModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeStudentDetailModal() {
  studentDetailModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function highlightSelectedStudentRows() {
  [...resultsTableBody.querySelectorAll("tr")].forEach((row) => {
    row.classList.toggle("selected-student-row", row.dataset.studentId === selectedStudentId);
  });
}

function readStoredData() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredData(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore storage failures for file:// environments.
  }
}

function clearStoredData() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures for file:// environments.
  }
}

function normalizeLoadedData(sourceData) {
  return {
    ...sourceData,
    metadata: {
      ...sourceData.metadata,
      activeProcesses: normalizeArray(sourceData.metadata?.activeProcesses),
      workbookOverview: sourceData.metadata?.workbookOverview
        ? {
          ...sourceData.metadata.workbookOverview,
          rows: normalizeArray(sourceData.metadata.workbookOverview.rows),
        }
        : null,
      workbookSummary: normalizeArray(sourceData.metadata?.workbookSummary),
      notes: normalizeArray(sourceData.metadata?.notes),
    },
    records: normalizeArray(sourceData.records).map((record) => ({
      ...record,
      subjects: normalizeArray(record.subjects),
    })),
  };
}

function mergeDataSources(bundledData, storedData) {
  return {
    ...bundledData,
    ...storedData,
    metadata: {
      ...bundledData.metadata,
      ...storedData.metadata,
      workbookOverview: storedData.metadata?.workbookOverview?.rows?.length
        ? storedData.metadata.workbookOverview
        : bundledData.metadata?.workbookOverview ?? null,
      workbookSummary: storedData.metadata?.workbookSummary?.length
        ? storedData.metadata.workbookSummary
        : bundledData.metadata?.workbookSummary ?? [],
      activeProcesses: storedData.metadata?.activeProcesses?.length
        ? storedData.metadata.activeProcesses
        : bundledData.metadata?.activeProcesses ?? [],
      notes: storedData.metadata?.notes?.length
        ? storedData.metadata.notes
        : bundledData.metadata?.notes ?? [],
    },
    stats: {
      ...bundledData.stats,
      ...storedData.stats,
    },
    records: storedData.records?.length ? storedData.records : bundledData.records,
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

async function buildDataFromWorkbook(file) {
  const zipEntries = await parseZipEntries(await file.arrayBuffer());
  const sharedStrings = parseSharedStrings(await readZipText(zipEntries, "xl/sharedStrings.xml"));
  const gradeLookup = await getGradeLookup(zipEntries, sharedStrings);
  const workbookOverview = await getWorkbookOverview(zipEntries, sharedStrings);
  const workbookSummary = await getWorkbookSummary(zipEntries, sharedStrings);

  const beginnerRecords = await convertSheetRecords({
    zipEntries,
    sharedStrings,
    sheetXmlName: "xl/worksheets/sheet2.xml",
    sourceSheet: "초급 과목수별 현황",
    defaultCategory: "초급",
    defaultProcessName: "초급",
    keepOnlyThreeOrMore: true,
  });

  const intermediateRecords = await convertSheetRecords({
    zipEntries,
    sharedStrings,
    sheetXmlName: "xl/worksheets/sheet3.xml",
    sourceSheet: "중급 과정별 분류",
    defaultCategory: "중급",
    defaultProcessName: "",
    usesSections: true,
  });

  const advancedRecords = await convertSheetRecords({
    zipEntries,
    sharedStrings,
    sheetXmlName: "xl/worksheets/sheet4.xml",
    sourceSheet: "고급 과정별 분류",
    defaultCategory: "고급",
    defaultProcessName: "",
    usesSections: true,
  });

  const records = [...beginnerRecords, ...intermediateRecords, ...advancedRecords];
  const enrichedRecords = records.map((record) => enrichRecord(record, gradeLookup));
  const processNames = [...new Set(enrichedRecords.map((record) => record.processName))].sort((left, right) => left.localeCompare(right, "ko-KR"));
  const uniqueStudents = new Set(enrichedRecords.map((record) => record.studentId));
  const eligibleRecords = enrichedRecords.filter((record) => record.scholarshipEligible);

  return {
    metadata: {
      sourceFile: file.name,
      generatedAt: formatDateTime(new Date()),
      inferredRule: "Scholarship is awarded per process after completion of at least 3 subjects with no duplicate payout inside the same process.",
      activeProcessCount: processNames.length,
      activeProcesses: processNames,
      workbookOverview,
      workbookSummary,
      notes: [
        "Beginner records include only students with 3 or more completed subjects.",
        "Intermediate and advanced overlap rules are taken from the classified process sheets instead of being recalculated from raw enrollment rows.",
        "F grades are already excluded by the source workbook.",
        "Average point is calculated only from subjects listed inside each classified process record.",
        "엑셀 변경분 불러오기를 누르면 현재 브라우저에서 바로 다시 계산합니다.",
      ],
    },
    stats: {
      totalRecords: enrichedRecords.length,
      eligibleRecords: eligibleRecords.length,
      uniqueStudents: uniqueStudents.size,
    },
    records: enrichedRecords,
  };
}

function enrichRecord(record, gradeLookup) {
  const gradedSubjects = record.subjects.map((subject) => {
    const key = `${record.studentId}|${subject}`;
    const gradeRow = gradeLookup.get(key);

    if (gradeRow) {
      return {
        name: subject,
        grade: gradeRow.grade,
        point: gradeRow.point,
      };
    }

    return {
      name: subject,
      grade: "",
      point: null,
    };
  });

  const scoredSubjects = gradedSubjects.filter((subject) => subject.point !== null);
  const averagePoint = scoredSubjects.length > 0
    ? Number((scoredSubjects.reduce((sum, subject) => sum + subject.point, 0) / scoredSubjects.length).toFixed(2))
    : null;

  return {
    category: record.category,
    processName: record.processName,
    sourceSheet: record.sourceSheet,
    name: record.name,
    studentId: record.studentId,
    department: record.department,
    year: record.year,
    subjectCount: record.subjectCount,
    scholarshipEligible: record.scholarshipEligible,
    gradedSubjectCount: scoredSubjects.length,
    averagePoint,
    subjects: gradedSubjects,
  };
}

async function convertSheetRecords({
  zipEntries,
  sharedStrings,
  sheetXmlName,
  sourceSheet,
  defaultCategory,
  defaultProcessName,
  usesSections = false,
  keepOnlyThreeOrMore = false,
}) {
  const sheet = parseSheetXml(await readZipText(zipEntries, sheetXmlName));
  const rows = getRows(sheet);
  const records = [];
  let activeProcessName = defaultProcessName;

  for (const row of rows) {
    const firstCell = getCellValue(row, "A", sharedStrings);

    if (usesSections && /^[^A-Za-z0-9].+\(.+:.+\)$/.test(firstCell)) {
      activeProcessName = firstCell.replace(/^[^\s]+\s*/, "").replace(/\s*\(.*$/, "").trim();
      continue;
    }

    if (firstCell === "No.") {
      continue;
    }

    const name = getCellValue(row, "B", sharedStrings);
    const studentId = getCellValue(row, "C", sharedStrings);

    if (!name || !studentId) {
      continue;
    }

    const subjectCountText = getCellValue(row, "F", sharedStrings);
    const subjectCount = subjectCountText ? Number(subjectCountText) : 0;

    const record = {
      category: defaultCategory,
      processName: activeProcessName,
      sourceSheet,
      name,
      studentId,
      department: getCellValue(row, "D", sharedStrings),
      year: getCellValue(row, "E", sharedStrings),
      subjectCount,
      subjects: splitSubjects(getCellValue(row, "I", sharedStrings)),
      scholarshipEligible: subjectCount >= 3,
    };

    if (keepOnlyThreeOrMore && !record.scholarshipEligible) {
      continue;
    }

    records.push(record);
  }

  return records;
}

async function getGradeLookup(zipEntries, sharedStrings) {
  const sheet = parseSheetXml(await readZipText(zipEntries, "xl/worksheets/sheet5.xml"));
  const rows = getRows(sheet).slice(3);
  const lookup = new Map();

  rows.forEach((row) => {
    const subject = getCellValue(row, "B", sharedStrings);
    const studentId = getCellValue(row, "E", sharedStrings);
    const grade = getCellValue(row, "J", sharedStrings);

    if (!subject || !studentId || !grade) {
      return;
    }

    lookup.set(`${studentId}|${subject}`, {
      subject,
      grade,
      point: getGradePoint(grade),
    });
  });

  return lookup;
}

async function getWorkbookSummary(zipEntries, sharedStrings) {
  const sheet = parseSheetXml(await readZipText(zipEntries, "xl/worksheets/sheet1.xml"));
  const rows = getRows(sheet);
  const summary = [];

  rows.forEach((row) => {
    const course = getCellValue(row, "B", sharedStrings);
    const division = getCellValue(row, "C", sharedStrings);
    const threeOrMore = getCellValue(row, "G", sharedStrings);

    if (!course || !division || !threeOrMore) {
      return;
    }

    if (division === "구분" || division === "소계" || course === "합계") {
      return;
    }

    const parsedCount = Number.parseInt(threeOrMore, 10);
    if (Number.isNaN(parsedCount)) {
      return;
    }

    summary.push({
      category: course,
      processName: division.length <= 2 ? course : division,
      threeOrMoreCount: parsedCount,
    });
  });

  return summary;
}

async function getWorkbookOverview(zipEntries, sharedStrings) {
  const sheet = parseSheetXml(await readZipText(zipEntries, "xl/worksheets/sheet1.xml"));
  const rows = getRows(sheet);
  const overviewRows = [];
  let started = false;

  rows.forEach((row) => {
    const category = getCellValue(row, "B", sharedStrings);
    const division = getCellValue(row, "C", sharedStrings);
    const totalCount = parseCountCell(getCellValue(row, "D", sharedStrings));
    const oneSubjectCount = parseCountCell(getCellValue(row, "E", sharedStrings));
    const twoSubjectCount = parseCountCell(getCellValue(row, "F", sharedStrings));
    const threeOrMoreCount = parseCountCell(getCellValue(row, "G", sharedStrings));

    if (!started) {
      if (category === "과정" && division === "구분") {
        started = true;
      }
      return;
    }

    const hasAnyValue = [category, division, totalCount, oneSubjectCount, twoSubjectCount, threeOrMoreCount]
      .some((value) => value !== "" && value !== null);
    if (!hasAnyValue) {
      return;
    }

    overviewRows.push({
      category,
      division,
      totalCount,
      oneSubjectCount,
      twoSubjectCount,
      threeOrMoreCount,
    });
  });

  return {
    title: "전체 MD 과정별 수강현황",
    rows: overviewRows,
  };
}

function parseCountCell(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? value : parsed;
}

function getGradePoint(grade) {
  const gradeMap = {
    "A+": 4.5,
    A0: 4.0,
    "B+": 3.5,
    B0: 3.0,
    "C+": 2.5,
    C0: 2.0,
    "D+": 1.5,
    D0: 1.0,
    P: null,
  };

  return Object.prototype.hasOwnProperty.call(gradeMap, grade) ? gradeMap[grade] : null;
}

function splitSubjects(value) {
  if (!value || !value.trim()) {
    return [];
  }

  return value.split(",").map((subject) => subject.trim()).filter(Boolean);
}

function parseSheetXml(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  const parseError = xml.querySelector("parsererror");

  if (parseError) {
    throw new Error("엑셀 시트 XML을 읽을 수 없습니다.");
  }

  return xml;
}

function getRows(xml) {
  return [...xml.getElementsByTagNameNS(SPREADSHEET_NS, "row")];
}

function getCellValue(row, column, sharedStrings) {
  const cells = [...row.getElementsByTagNameNS(SPREADSHEET_NS, "c")];
  const cell = cells.find((item) => (item.getAttribute("r") || "").startsWith(column));

  if (!cell) {
    return "";
  }

  const type = cell.getAttribute("t");
  const valueNode = cell.getElementsByTagNameNS(SPREADSHEET_NS, "v")[0];
  if (valueNode) {
    const raw = valueNode.textContent ?? "";
    if (type === "s") {
      return sharedStrings[Number(raw)] ?? "";
    }

    return raw;
  }

  const inlineTextNodes = [...cell.getElementsByTagNameNS(SPREADSHEET_NS, "t")];
  if (inlineTextNodes.length > 0) {
    return inlineTextNodes.map((node) => node.textContent ?? "").join("");
  }

  return "";
}

function parseSharedStrings(xmlText) {
  if (!xmlText) {
    return [];
  }

  const xml = parseSheetXml(xmlText);
  const items = [...xml.getElementsByTagNameNS(SPREADSHEET_NS, "si")];

  return items.map((item) => {
    const textParts = [...item.getElementsByTagNameNS(SPREADSHEET_NS, "t")].map((node) => node.textContent ?? "");
    return textParts.join("").replace(/\s+/g, " ").trim();
  });
}

async function parseZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const endOffset = findEndOfCentralDirectory(bytes);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);
  const entries = new Map();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("ZIP 중앙 디렉터리를 읽을 수 없습니다.");
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const fileCommentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileName = decodeZipText(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataBytes = bytes.slice(dataOffset, dataOffset + compressedSize);

    entries.set(fileName, {
      compressionMethod,
      dataBytes,
    });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(bytes) {
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }

  throw new Error("ZIP 끝 레코드를 찾을 수 없습니다.");
}

async function readZipText(entries, name) {
  const entry = entries.get(name);
  if (!entry) {
    return "";
  }

  const bytes = await decompressZipEntry(entry);
  return new TextDecoder("utf-8").decode(bytes);
}

async function decompressZipEntry(entry) {
  if (entry.compressionMethod === 0) {
    return entry.dataBytes;
  }

  if (entry.compressionMethod !== 8) {
    throw new Error("지원하지 않는 ZIP 압축 방식입니다.");
  }

  const stream = new Blob([entry.dataBytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function decodeZipText(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

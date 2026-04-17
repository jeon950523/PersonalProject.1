const saveBtn = document.querySelector(".saveBtn");
const clearBtn = document.querySelector(".clearBtn");
const statusDisplay = document.querySelector(".status");
const result = document.querySelector(".result");

const STORAGE_KEY = "saramin-saved-jobs";

function loadSavedJobs() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], function (data) {
      resolve(data[STORAGE_KEY] || []);
    });
  });
}

function saveMergedJobs(newJobs) {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], function (data) {
      const savedJobs = data[STORAGE_KEY] || [];
      const jobMap = new Map();

      savedJobs.forEach(job => jobMap.set(job.id, job));
      newJobs.forEach(job => jobMap.set(job.id, job));

      const mergedJobs = [...jobMap.values()];

      chrome.storage.local.set({ [STORAGE_KEY]: mergedJobs }, function () {
        resolve(mergedJobs);
      });
    });
  });
}

function clearSavedJobs() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(STORAGE_KEY, function () {
      resolve();
    });
  });
}

function createJobRow(label, value) {
  const row = document.createElement("p");
  row.className = "jobRow";

  const labelSpan = document.createElement("span");
  labelSpan.className = "jobLabel";
  labelSpan.textContent = label;

  const valueSpan = document.createElement("span");
  valueSpan.textContent = value;

  row.append(labelSpan);
  row.append(valueSpan);

  return row;
}

function createJobCard(job) {
  const card = document.createElement("article");
  card.className = "jobCard";

  const title = document.createElement("h2");
  title.className = "jobCardTitle";
  title.textContent = job.title;

  const companyRow = createJobRow("회사명:", job.company);
  const careerRow = createJobRow("경력:", job.career);
  const requiredRow = createJobRow("학력:", job.required);
  const locationRow = createJobRow("지역:", job.location);
  const employmentTypeRow = createJobRow("고용형태:", job.employmentType);
  const preferredRow = createJobRow("우대/키워드:", job.preferred);

  card.append(title);
  card.append(companyRow);
  card.append(careerRow);
  card.append(requiredRow);
  card.append(locationRow);
  card.append(employmentTypeRow);
  card.append(preferredRow);

  if (job.url) {
    const link = document.createElement("a");
    link.className = "jobLink";
    link.href = job.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "공고 바로가기";

    card.append(link);
  }

  return card;
}

function renderJobs(jobs) {
  result.textContent = "";

  if (jobs.length === 0) {
    statusDisplay.textContent = "저장된 공고가 없습니다";
    return;
  }

  statusDisplay.textContent = "저장된 공고 수: " + jobs.length + "개";

  jobs.forEach(function (job) {
    const card = createJobCard(job);
    result.append(card);
  });
}

function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      resolve(tabs[0]);
    });
  });
}

function collectJobsFromPage() {
  return new Promise(async (resolve) => {
    const currentTab = await getCurrentTab();

    chrome.tabs.sendMessage(
      currentTab.id,
      { action: "COLLECT_JOBS" },
      function (response) {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            message: "사람인 페이지에서만 실행 가능합니다."
          });
          return;
        }

        resolve(response);
      }
    );
  });
}

saveBtn.addEventListener("click", async function () {
  const response = await collectJobsFromPage();

  if (!response.ok) {
    statusDisplay.textContent = response.message;
    result.textContent = "";
    return;
  }

  const mergedJobs = await saveMergedJobs(response.jobs);
  statusDisplay.textContent =
    "저장 완료: " + response.jobs.length + "개 / 전체: " + mergedJobs.length + "개";
  renderJobs(mergedJobs);
});

clearBtn.addEventListener("click", async function () {
  await clearSavedJobs();
  renderJobs([]);
});

(async function init() {
  const savedJobs = await loadSavedJobs();
  renderJobs(savedJobs);
})();
function isJobListPage() {
  return location.pathname.startsWith('/zf_user/jobs/list/');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getText(element) {
  if (!element) {
    return '정보없음';
  }
  return element.textContent.trim().replace(/\s+/g, ' ');
}

function getRecruitCards() {
  return [...document.querySelectorAll('#default_list_wrap .list_recruiting .list_body .list_item')];
}

function getJobUrl(card) {
  const titleLink = card.querySelector('.job_tit a.str_tit, .job_tit a[href*="/zf_user/jobs/"]');
  return titleLink ? titleLink.href : '';
}

function getCompanyElement(card) {
  return card.querySelector('.company_nm a, .company_nm, [class*="company"] a, [class*="company"]');
}

function getTitleElement(card) {
  return card.querySelector('.job_tit a.str_tit > span, .job_tit a.str_tit, .job_tit a[href*="/zf_user/jobs/"] > span, .job_tit a[href*="/zf_user/jobs/"]');
}

function getMetaTexts(card) {
  const metaSelectors = [
    '.notification_info .job_meta span',
    '.notification_info .job_condition span',
    '.notification_info .condition_area span',
    '.notification_info .job_sector a',
    '.notification_info .job_sector span',
    '.notification_info .recruit_condition span',
    '.notification_info .recruit_condition a',
    '.notification_info .job_info span',
    '.notification_info .job_info a',
    '.notification_info .info_area span',
    '.notification_info .info_area a'
  ];

  const values = [];
  const seen = new Set();

  metaSelectors.forEach(selector => {
    card.querySelectorAll(selector).forEach(el => {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      if (text && !seen.has(text)) {
        seen.add(text);
        values.push(text);
      }
    });
  });

  return values;
}

function parseMeta(metaTexts) {
  const locationKeywords = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '재택', '전국'];
  const careerKeywords = ['신입', '경력', '경력무관', '인턴', '주니어', '시니어'];
  const educationKeywords = ['학력', '대졸', '초대졸', '고졸', '석사', '박사', '무관'];
  const employmentKeywords = ['정규직', '계약직', '인턴', '프리랜서', '파견직', '아르바이트', '위촉직', '연수생'];

  let location = '정보없음';
  let career = '정보없음';
  let required = '정보없음';
  let employmentType = '정보없음';

  for (const text of metaTexts) {
    if (location === '정보없음' && locationKeywords.some(keyword => text.includes(keyword))) {
      location = text;
      continue;
    }
    if (career === '정보없음' && careerKeywords.some(keyword => text.includes(keyword))) {
      career = text;
      continue;
    }
    if (required === '정보없음' && educationKeywords.some(keyword => text.includes(keyword))) {
      required = text;
      continue;
    }
    if (employmentType === '정보없음' && employmentKeywords.some(keyword => text.includes(keyword))) {
      employmentType = text;
      continue;
    }
  }

  const extras = metaTexts.filter(text => ![location, career, required, employmentType].includes(text));

  return {
    location,
    career,
    required,
    employmentType,
    preferred: extras.join(', ') || '정보없음'
  };
}

function getJobData(card) {
  const companyElement = getCompanyElement(card);
  const titleElement = getTitleElement(card);
  const metaTexts = getMetaTexts(card);
  const parsedMeta = parseMeta(metaTexts);
  const jobUrl = getJobUrl(card);

  const company = getText(companyElement);
  const title = getText(titleElement);
  const id = jobUrl || company + '_' + title;

  return {
    id,
    company,
    title,
    career: parsedMeta.career,
    required: parsedMeta.required,
    location: parsedMeta.location,
    employmentType: parsedMeta.employmentType,
    preferred: parsedMeta.preferred,
    url: jobUrl
  };
}

async function autoScrollAndCollect(maxRounds = 8, delay = 1200) {
  let previousCount = 0;
  let stableRounds = 0;

  for (let i = 0; i < maxRounds; i += 1) {
    const cards = getRecruitCards();
    const currentCount = cards.length;

    if (currentCount === previousCount) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
      previousCount = currentCount;
    }

    if (stableRounds >= 2) {
      break;
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    const wrap = document.querySelector('#default_list_wrap');
    if (wrap) {
      wrap.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }

    await sleep(delay);
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
  return getRecruitCards();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'COLLECT_JOBS') {
    if (!isJobListPage()) {
      sendResponse({
        ok: false,
        message: '채용 목록 페이지에서만 사용할 수 있습니다.'
      });
      return;
    }

    autoScrollAndCollect().then(cards => {
      if (cards.length === 0) {
        sendResponse({
          ok: false,
          message: '현재 페이지에서 공고를 찾지 못했습니다.'
        });
        return;
      }

      const jobs = cards
        .map(card => getJobData(card))
        .filter(job => job.title !== '정보없음');

      if (jobs.length === 0) {
        sendResponse({
          ok: false,
          message: '공고 데이터를 읽지 못했습니다.'
        });
        return;
      }

      sendResponse({
        ok: true,
        jobs
      });
    }).catch(error => {
      console.error(error);
      sendResponse({
        ok: false,
        message: '공고 수집 중 오류가 발생했습니다.'
      });
    });

    return true;
  }
});

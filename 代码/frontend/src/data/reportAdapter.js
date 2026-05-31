import { ref } from "vue";
import { reportData as mockReportData } from "./mockReport";
import aiReplaySampleText from "./aiReplaySample.txt?raw";

const sectionAliases = {
  "总览": "summary",
  "票型分析": "votes",
  "发言问题": "speech",
  "技能评估": "skills",
  "关键失误": "mistakes",
  "策略建议": "recommendations",
  "行动项": "actions",
};

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function extractFencedJson(rawText) {
  const match = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  return match ? parseJson(match[1]) : null;
}

function extractSections(rawText) {
  const withoutJson = rawText.replace(/```json[\s\S]*?```/gi, "");
  const lines = withoutJson.split(/\r?\n/);
  const sections = {};
  let activeKey = null;

  lines.forEach((line) => {
    const title = line.trim().replace(/^#{1,6}\s*/, "").trim();
    if (sectionAliases[title]) {
      activeKey = sectionAliases[title];
      sections[activeKey] = [];
      return;
    }
    if (activeKey && !/^\s*[-=]{2,}\s*$/.test(line)) {
      sections[activeKey].push(line);
    }
  });

  return Object.fromEntries(
    Object.entries(sections).map(([key, linesInSection]) => [key, linesInSection.join("\n").trim()]),
  );
}

function nonEmptyLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listLines(value) {
  return nonEmptyLines(value).map((line) => line.replace(/^[-*]\s*/, "").trim());
}

function splitParagraphs(value) {
  return String(value || "")
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function findNarrative(rawText) {
  const prose = rawText.replace(/```json[\s\S]*?```/gi, "").trim();
  return prose.replace(/^#{1,6}\s+.*(?:\r?\n)+/, "").trim();
}

function normalizePlayerId(value) {
  if (!value) return value;
  if (/^Player/i.test(value)) return value;
  const match = String(value).match(/p(\d+)/i);
  return match ? `Player${match[1]}` : String(value);
}

function parseVoteChips(summary) {
  if (!summary || summary.includes("弃票") || summary.includes("无人")) return [];
  return summary
    .split(/[，,、]/)
    .map((item) => item.trim())
    .filter((item) => /\d+\s*(?:获|获得)?\s*\d+\s*票/.test(item));
}

function buildMarkdownVoteRounds(section) {
  return listLines(section)
    .map((line, index) => {
      const jsonStart = line.indexOf("{");
      const item = parseJson(jsonStart >= 0 ? line.slice(jsonStart) : line);
      const roundMatch = line.slice(0, jsonStart >= 0 ? jsonStart : line.length).match(/round[_\s-]*(\d+)/i);
      return item
        ? {
            round: `第 ${item.round || roundMatch?.[1] || index + 1} 轮投票`,
            headline: item.vote_summary || "本轮票型待分析",
            voteSummary: item.vote_summary || "",
            anomaly: item.anomalies || item.anomaly || "",
            players: parseVoteChips(item.vote_summary),
          }
        : null;
    })
    .filter(Boolean);
}

function buildStructuredVoteRounds(voteAnalysis) {
  if (!voteAnalysis) return [];

  return Object.entries(voteAnalysis).map(([roundKey, roundValue], index) => {
    const players = Object.entries(roundValue.vote_counts || {}).map(([playerId, count]) => {
      return `${normalizePlayerId(playerId)} ${count}票`;
    });
    const voteSummary = roundValue.vote_summary || (players.length ? players.join("，") : "本轮无有效投票");
    const roundMatch = roundKey.match(/(\d+)/);

    return {
      round: `第 ${roundMatch?.[1] || index + 1} 轮投票`,
      headline: roundValue.voted_out ? `${roundValue.voted_out} 被投出局` : voteSummary,
      voteSummary,
      anomaly: roundValue.anomaly || roundValue.anomalies || roundValue.analysis || "",
      players: players.length ? players : parseVoteChips(voteSummary),
    };
  });
}

function issuePlayerLabel(issue, index) {
  const match = String(issue).match(/^(多名玩家|全员|狼人阵营|好人阵营|预言家|女巫|\d+号玩家?)/);
  return match?.[1] || `问题 ${index + 1}`;
}

function buildSpeechIssues(markdownSection, structuredIssues) {
  if (Array.isArray(structuredIssues) && structuredIssues.length) {
    return structuredIssues.map((item, index) => ({
      player: typeof item === "string" ? issuePlayerLabel(item, index) : item.player || `问题 ${index + 1}`,
      issue: typeof item === "string" ? item : item.issue || "未提供问题描述",
      reason: typeof item === "string" ? "" : item.reason || "",
    }));
  }

  return listLines(markdownSection)
    .map((line, index) => {
      const item = parseJson(line);
      return item
        ? {
            player: item.player || `问题 ${index + 1}`,
            issue: item.issue || "未提供问题描述",
            reason: item.reason || "",
          }
        : {
            player: issuePlayerLabel(line, index),
            issue: line,
            reason: "",
          };
    });
}

function parseLabeledItems(section) {
  return listLines(section).map((line) => {
    const match = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    return match ? { title: match[1].trim(), detail: match[2].trim() } : { title: "", detail: line };
  });
}

function buildSkills(markdownSection, structuredSkills) {
  if (Array.isArray(structuredSkills) && structuredSkills.length) {
    return structuredSkills.map((item) => {
      if (typeof item === "string") {
        const roleMatch = item.match(/^(预言家|女巫|狼人)/);
        return { title: roleMatch?.[1] || "技能表现", detail: item };
      }
      return {
        title: item.player ? `${item.role}（${item.player}）` : item.role,
        detail: `${(item.actions || []).join("；")}。${item.evaluation || ""}`.replace(/^。|。$/g, ""),
      };
    });
  }
  return parseLabeledItems(markdownSection).map((item) => {
    if (item.title) return item;
    const roleMatch = item.detail.match(/^(预言家|女巫|狼人)/);
    return { title: roleMatch?.[1] || "技能表现", detail: item.detail };
  });
}

function buildMistakes(markdownSection, structuredMistakes) {
  if (Array.isArray(structuredMistakes) && structuredMistakes.length) {
    return structuredMistakes.map((item) =>
      typeof item === "string"
        ? { title: "风险点", detail: item }
        : {
            title: item.player || "关键失误",
            detail: item.impact ? `${item.mistake}。影响：${item.impact}` : item.mistake,
          },
    );
  }
  return listLines(markdownSection).map((detail) => ({ title: "风险点", detail }));
}

function getWinningCamp(summary, baseMeta) {
  const match = summary.match(/(好人|狼人)阵营(?:最终)?获胜/);
  return match ? `${match[1]}阵营获胜` : baseMeta.winningCamp;
}

function buildMeta(baseMeta, summary, gameId) {
  const modeMatch = summary.match(/(\d+)人/);
  return {
    ...baseMeta,
    gameId: gameId || baseMeta.gameId || "——",
    mode: modeMatch ? `${modeMatch[1]} 人局` : baseMeta.mode,
    winningCamp: getWinningCamp(summary, baseMeta),
    narrator: summary || baseMeta.narrator,
  };
}

function buildOverview(meta, voteRounds, speechIssues, skills, mistakes) {
  const featuredSkill = skills.find((item) => item.title.includes("女巫")) || skills[0];
  return [
    {
      label: "胜利阵营",
      value: meta.winningCamp,
      note: "由 AI 复盘报告提取的对局结论",
    },
    {
      label: "票型分析",
      value: `${voteRounds.length} 轮`,
      note: voteRounds.length ? "投票结果与异常观察已整理" : "报告未提供票型记录",
    },
    {
      label: "发言问题",
      value: `${speechIssues.length} 项`,
      note: speechIssues.length ? "需要重点回看的发言风险" : "报告未标记明显问题",
    },
    {
      label: "关键技能",
      value: featuredSkill ? featuredSkill.title : "待分析",
      note: featuredSkill ? featuredSkill.detail : `${mistakes.length} 项关键失误待复核`,
    },
  ];
}

function buildReportData(baseReport, replayText, gameId, structuredReport = null) {
  const sections = extractSections(replayText);
  const structured = structuredReport || extractFencedJson(replayText);
  const summaryText = structured?.summary_report || sections.summary || findNarrative(replayText) || baseReport.meta.narrator;
  const summaryParagraphs = splitParagraphs(summaryText);
  const markdownVoteRounds = buildMarkdownVoteRounds(sections.votes);
  const voteRounds = structured?.vote_analysis
    ? buildStructuredVoteRounds(structured.vote_analysis)
    : markdownVoteRounds;
  const speechIssues = buildSpeechIssues(sections.speech, structured?.speech_issues);
  const skillEvaluations = buildSkills(sections.skills, structured?.skill_evaluation);
  const mistakes = buildMistakes(sections.mistakes, structured?.mistakes);
  const strategyRecommendations = structured?.strategy_recommendations?.length
    ? structured.strategy_recommendations
    : listLines(sections.recommendations);
  const actionItems = structured?.action_items?.length
    ? structured.action_items
    : listLines(sections.actions);
  const meta = buildMeta(baseReport.meta, summaryText, gameId);

  return {
    meta,
    summaryParagraphs,
    overview: buildOverview(meta, voteRounds, speechIssues, skillEvaluations, mistakes),
    voteRounds,
    speechIssues,
    skillEvaluations,
    mistakes,
    strategyRecommendations,
    actionItems,
    heroTags: [
      `${voteRounds.length} 轮票型分析`,
      `${speechIssues.length} 项发言问题`,
      `${mistakes.length} 项关键失误`,
    ],
  };
}

export const reportData = ref(buildReportData(mockReportData, aiReplaySampleText));
export const isLoading = ref(false);
export const loadError = ref(null);

function takeTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || params.get("accessToken");
  if (!token) return "";

  params.delete("token");
  params.delete("accessToken");
  sessionStorage.setItem("accessToken", token);
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
  return token;
}

function getCookie(name) {
  const match = document.cookie.split(";").find((cookie) => cookie.trim().startsWith(`${name}=`));
  return match ? decodeURIComponent(match.trim().slice(name.length + 1)) : "";
}

function getAuthToken() {
  return takeTokenFromUrl() || getCookie("accessToken") || sessionStorage.getItem("accessToken") || "";
}

function resolveFilePath(data, format) {
  const files = data.analysisFiles || data.analysis_files || data.replayFiles || data.replay_files || {};
  const filePath = format === "json"
    ? files.json || files.jsonPath || files.json_path || data.jsonPath || data.json_path
    : files.text || files.txt || files.path || files.report || data.textPath || data.text_path || data.path;
  return typeof filePath === "string" ? filePath : null;
}

async function fetchReplayFile(filePath) {
  if (!filePath) return "";
  const response = await fetch(`/api/game/replay/file?file=${encodeURIComponent(filePath)}`);
  return response.text();
}

function getStructuredReport(value) {
  if (!value) return null;
  if (typeof value === "string") return parseJson(value);
  if (typeof value === "object") return Object.keys(value).length ? value : null;
  return null;
}

function resolveDetailData(json) {
  if (json && Object.prototype.hasOwnProperty.call(json, "success")) {
    return json.data || {};
  }
  return json || {};
}

export async function loadReport(gameId) {
  isLoading.value = true;
  loadError.value = null;
  try {
    const token = getAuthToken();
    const res = await fetch(`/api/game/replay/detail/auth?gameId=${encodeURIComponent(gameId)}`, {
      method: "GET",
      headers: { authorization: token },
    });
    const json = await res.json();
    if (json.success === false) {
      loadError.value = json.errorMessage || "复盘分析失败";
      return;
    }
    const data = resolveDetailData(json);
    const analysis = data.analysis || {};
    let text = typeof analysis.text === "string" ? analysis.text : "";
    let structuredReport = getStructuredReport(analysis.json || data.analysisJson || data.analysis_json);
    const textPath = resolveFilePath(data, "text");
    const jsonPath = resolveFilePath(data, "json");

    const [fileText, jsonText] = await Promise.all([
      !text && textPath ? fetchReplayFile(textPath) : Promise.resolve(""),
      !structuredReport && jsonPath ? fetchReplayFile(jsonPath) : Promise.resolve(""),
    ]);
    text = text || fileText;
    structuredReport = structuredReport || parseJson(jsonText);

    if (!text && !structuredReport) {
      loadError.value = "未找到复盘内容";
      return;
    }

    reportData.value = buildReportData(mockReportData, text, data.gameId || gameId, structuredReport);
  } catch (err) {
    loadError.value = err.message || "加载失败";
  } finally {
    isLoading.value = false;
  }
}

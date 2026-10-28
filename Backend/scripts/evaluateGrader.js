/**
 * Measures how closely the AI grader (LLM-as-a-judge) agrees with hand grades.
 *
 * Input:  eval/hand_grades.csv with human_correctness, human_depth, human_structure
 *         (and human_star for behavioral answers) filled in, scores 1-5.
 * Output: eval/results/grader_<version>.json and a row appended to eval/results/history.csv,
 *         so each prompt/rubric version can be compared with the previous ones.
 *
 * Metrics per criterion:
 *   exact agreement    - AI score equals the hand score
 *   within-1 agreement - AI score is at most 1 point away
 *   MAE                - mean absolute difference
 *   quadratic weighted Cohen's kappa - agreement corrected for chance (1 = perfect, 0 = chance)
 *
 * AI grades are cached per grader version in eval/cache, so re-running is free.
 * Usage: npm run eval:grader
 */
require("dotenv").config({ quiet: true })
const fs = require("fs")
const path = require("path")
const { gradeAnswer, GRADER_VERSION } = require("../src/services/grader.service")
const { parseCsv } = require("./csv")

const EVAL_DIR = path.join(__dirname, "..", "eval")
const GRADES_PATH = path.join(EVAL_DIR, "hand_grades.csv")
const CACHE_PATH = path.join(EVAL_DIR, "cache", `ai_grades_${GRADER_VERSION}.json`)
const RESULTS_DIR = path.join(EVAL_DIR, "results")
const CRITERIA = ["correctness", "depth", "structure", "star"]

function quadraticWeightedKappa(a, b, min = 1, max = 5) {
    const n = max - min + 1
    const observed = Array.from({ length: n }, () => new Array(n).fill(0))
    a.forEach((x, i) => observed[x - min][b[i] - min]++)
    const histA = observed.map((row) => row.reduce((s, v) => s + v, 0))
    const histB = observed[0].map((_, j) => observed.reduce((s, row) => s + row[j], 0))
    const total = a.length
    let num = 0, den = 0
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const weight = ((i - j) ** 2) / ((n - 1) ** 2)
            num += weight * observed[i][j]
            den += weight * (histA[i] * histB[j]) / total
        }
    }
    return den === 0 ? 1 : 1 - num / den
}

function summarize(human, ai) {
    const diffs = human.map((h, i) => Math.abs(h - ai[i]))
    const r = (x) => Math.round(x * 1000) / 1000
    return {
        n: human.length,
        exactAgreement: r(diffs.filter((d) => d === 0).length / diffs.length),
        withinOneAgreement: r(diffs.filter((d) => d <= 1).length / diffs.length),
        meanAbsoluteError: r(diffs.reduce((s, d) => s + d, 0) / diffs.length),
        quadraticWeightedKappa: r(quadraticWeightedKappa(human, ai)),
    }
}

async function main() {
    if (!fs.existsSync(GRADES_PATH)) {
        console.error(`No ${GRADES_PATH}. Run "npm run export:answers" and hand-grade the answers first.`)
        process.exit(1)
    }
    const rows = parseCsv(fs.readFileSync(GRADES_PATH, "utf8"))
        .filter((r) => r.answer && r.human_correctness && r.human_depth && r.human_structure)
    if (!rows.length) {
        console.error("No hand-graded rows yet. Fill the human_* columns in eval/hand_grades.csv (scores 1-5).")
        process.exit(1)
    }

    const cache = fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) : {}
    console.log(`Evaluating grader ${GRADER_VERSION} on ${rows.length} hand-graded answers...`)

    for (const [i, row] of rows.entries()) {
        if (cache[row.id]) continue
        cache[row.id] = await gradeAnswer({ question: row.question, questionType: row.questionType, answer: row.answer })
        fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true })
        fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
        process.stdout.write(`  graded ${i + 1}/${rows.length}\r`)
    }

    const results = { graderVersion: GRADER_VERSION, evaluatedAt: new Date().toISOString(), answers: rows.length, criteria: {} }
    const allHuman = [], allAi = []
    for (const criterion of CRITERIA) {
        const pairs = rows
            .map((r) => [Number(r[`human_${criterion}`]), cache[r.id]?.[criterion]])
            .filter(([h, a]) => h >= 1 && h <= 5 && typeof a === "number")
        if (!pairs.length) continue
        results.criteria[criterion] = summarize(pairs.map((p) => p[0]), pairs.map((p) => p[1]))
        pairs.forEach(([h, a]) => { allHuman.push(h); allAi.push(a) })
    }
    results.overall = summarize(allHuman, allAi)

    fs.mkdirSync(RESULTS_DIR, { recursive: true })
    fs.writeFileSync(path.join(RESULTS_DIR, `grader_${GRADER_VERSION}.json`), JSON.stringify(results, null, 2))
    const historyPath = path.join(RESULTS_DIR, "history.csv")
    if (!fs.existsSync(historyPath)) {
        fs.writeFileSync(historyPath, "evaluatedAt,graderVersion,answers,exactAgreement,withinOneAgreement,meanAbsoluteError,quadraticWeightedKappa\n")
    }
    const o = results.overall
    fs.appendFileSync(historyPath, `${results.evaluatedAt},${GRADER_VERSION},${rows.length},${o.exactAgreement},${o.withinOneAgreement},${o.meanAbsoluteError},${o.quadraticWeightedKappa}\n`)

    console.log(`\nGrader ${GRADER_VERSION} vs hand grades (${rows.length} answers)`)
    console.table({ ...results.criteria, overall: results.overall })
    console.log(`AI grading matched hand grading exactly ${(o.exactAgreement * 100).toFixed(0)}% of the time, ` +
        `and within one point ${(o.withinOneAgreement * 100).toFixed(0)}% of the time.`)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})

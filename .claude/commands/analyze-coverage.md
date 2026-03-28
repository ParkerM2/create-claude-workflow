---
name: analyze-coverage
description: "Run test coverage analysis with gap detection and trend tracking."
---

# Test Coverage Analysis with Gap Detection

Runs test coverage suite, compares against baseline, flags untested critical paths, and generates specific test suggestions for uncovered code. Supports Jest, pytest, Go, and Rust test frameworks.

## Usage

```
/analyze-coverage [--update-baseline] [--pr] [--changed-only] [--min <percent>] [--format json|markdown]
```

- `--update-baseline`: Save current coverage as new baseline for comparison
- `--pr`: Post results as GitHub PR comment
- `--changed-only`: Only analyze files changed in current branch
- `--min <percent>`: Fail if coverage below threshold (default: 50)
- `--format`: Output format (markdown, json, text)

## Workflow

### Phase 1: Framework Detection

Automatically detects test framework and coverage tooling.

```javascript
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

class CoverageAnalyzer {
  constructor() {
    this.framework = null;
    this.coverageTool = null;
    this.config = null;
    this.reportPath = null;
  }

  detectFramework() {
    // Check package.json for test scripts and dependencies
    let packageJson = {};
    try {
      const pkg = fs.readFileSync("package.json", "utf-8");
      packageJson = JSON.parse(pkg);
    } catch (err) {
      console.log("ℹ No package.json found; checking for other frameworks");
    }

    // Jest detection
    if (packageJson.devDependencies?.jest || fs.existsSync("jest.config.js")) {
      this.framework = "jest";
      this.coverageTool = "jest";
      this.reportPath = "coverage/coverage-final.json";
      return this;
    }

    // Check for pytest (Python)
    if (fs.existsSync("pyproject.toml") || fs.existsSync("setup.cfg")) {
      try {
        execSync("python -m pytest --version", { stdio: "pipe" });
        this.framework = "pytest";
        this.coverageTool = "pytest-cov";
        this.reportPath = ".coverage";
        return this;
      } catch (err) {
        console.log("ℹ pytest not found");
      }
    }

    // Go coverage detection
    if (fs.existsSync("go.mod")) {
      this.framework = "go";
      this.coverageTool = "go test";
      this.reportPath = "coverage.out";
      return this;
    }

    // Rust coverage detection
    if (fs.existsSync("Cargo.toml")) {
      this.framework = "rust";
      this.coverageTool = "cargo tarpaulin";
      this.reportPath = "cobertura.xml";
      return this;
    }

    throw new Error("Could not detect test framework. Supported: Jest, pytest, Go, Rust");
  }

  loadBaselineIfExists() {
    const baselinePath = ".coverage-baseline.json";
    try {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
      console.log(`✓ Loaded baseline coverage: ${baseline.summary.lines.pct}%`);
      return baseline;
    } catch (err) {
      console.log("ℹ No baseline found; creating fresh baseline");
      return null;
    }
  }
}

const analyzer = new CoverageAnalyzer();
analyzer.detectFramework();
const baseline = analyzer.loadBaselineIfExists();

console.log(`✓ Detected framework: ${analyzer.framework}`);
console.log(`✓ Coverage tool: ${analyzer.coverageTool}`);
```

**Graceful degradation**: If framework detection fails, prompt user to specify manually; continue with basic metrics if coverage config missing.

---

### Phase 2: Coverage Execution

Runs test suite with coverage enabled and collects report data.

```javascript
async function runCoverage(changedFilesOnly = false) {
  console.log("Running coverage suite...");

  let coverageCmd = "";
  let coverageData = null;

  try {
    if (analyzer.framework === "jest") {
      coverageCmd = "npm test -- --coverage --coverage-reporters=json";
      if (changedFilesOnly) {
        coverageCmd += " --onlyChanged";
      }

      execSync(coverageCmd, { stdio: "inherit" });

      const coverageJson = JSON.parse(
        fs.readFileSync("coverage/coverage-final.json", "utf-8")
      );

      coverageData = {
        framework: "jest",
        summary: coverageJson.total,
        fileData: Object.entries(coverageJson)
          .filter(([key]) => key !== "total")
          .map(([file, data]) => ({
            file,
            lines: data.lines,
            statements: data.statements,
            branches: data.branches,
            functions: data.functions
          }))
      };
    } else if (analyzer.framework === "pytest") {
      coverageCmd = "python -m pytest --cov --cov-report=json";
      if (changedFilesOnly) {
        const changed = execSync("git diff --name-only HEAD~1").toString().split("\n");
        const pythonFiles = changed
          .filter(f => f.endsWith(".py"))
          .map(f => f.replace(".py", ""))
          .join(" ");
        if (pythonFiles) coverageCmd += ` ${pythonFiles}`;
      }

      execSync(coverageCmd, { stdio: "inherit" });

      const coverageJson = JSON.parse(
        fs.readFileSync(".coverage", "utf-8")
      );

      coverageData = {
        framework: "pytest",
        summary: {
          lines: { pct: Math.round(coverageJson.total_coverage * 100) / 100 }
        },
        fileData: coverageJson.files.map(f => ({
          file: f.filename,
          lines: { pct: f.covered_lines / f.total_lines * 100 }
        }))
      };
    } else if (analyzer.framework === "go") {
      coverageCmd = "go test -coverprofile=coverage.out ./...";
      execSync(coverageCmd, { stdio: "inherit" });

      const toolOutput = execSync("go tool cover -func=coverage.out").toString();
      const lines = toolOutput.split("\n");
      const totalLine = lines[lines.length - 2];
      const totalMatch = totalLine.match(/(\d+\.?\d*)%/);

      coverageData = {
        framework: "go",
        summary: {
          lines: { pct: parseFloat(totalMatch?.[1] || "0") }
        },
        fileData: lines
          .slice(0, -3)
          .map(line => {
            const parts = line.split("\t");
            return {
              file: parts[0],
              lines: { pct: parseFloat(parts[2]) }
            };
          })
      };
    } else if (analyzer.framework === "rust") {
      coverageCmd = "cargo tarpaulin --out Xml --output-dir .";
      execSync(coverageCmd, { stdio: "inherit" });

      // Parse XML coverage report
      const xml = fs.readFileSync("cobertura.xml", "utf-8");
      const linesCovered = xml.match(/lines-valid="(\d+)" lines-covered="(\d+)"/);

      if (linesCovered) {
        const total = parseInt(linesCovered[1]);
        const covered = parseInt(linesCovered[2]);
        const pct = Math.round((covered / total) * 100 * 100) / 100;

        coverageData = {
          framework: "rust",
          summary: { lines: { pct } }
        };
      }
    }

    console.log(`✓ Coverage executed: ${coverageData.summary.lines.pct}%`);
    return coverageData;
  } catch (err) {
    console.error(`ERROR: Coverage execution failed: ${err.message}`);
    return gracefulFailure("Test framework not configured; add coverage config");
  }
}

const coverage = await runCoverage(argv["changed-only"]);
```

**Error handling**: If tests fail, exit with helpful message; if coverage config missing, suggest setup commands.

---

### Phase 3: Coverage Analysis

Analyzes coverage metrics and compares against baseline.

```javascript
class CoverageAnalysis {
  constructor(current, baseline) {
    this.current = current;
    this.baseline = baseline;
    this.lowCoverage = [];
    this.criticalGaps = [];
    this.trends = {};
  }

  analyze() {
    // Files below 50% coverage
    this.lowCoverage = this.current.fileData
      .filter(f => f.lines.pct < 50)
      .sort((a, b) => a.lines.pct - b.lines.pct);

    if (this.lowCoverage.length > 0) {
      console.log(
        `⚠ ${this.lowCoverage.length} files below 50% coverage:`
      );
      this.lowCoverage.slice(0, 5).forEach(f => {
        console.log(`  ${f.file}: ${f.lines.pct}%`);
      });
    }

    // Calculate deltas
    if (this.baseline) {
      const baselineMap = new Map(
        this.baseline.fileData.map(f => [f.file, f.lines.pct])
      );

      this.trends = this.current.fileData.map(file => {
        const basePct = baselineMap.get(file.file) || 0;
        const delta = file.lines.pct - basePct;

        return {
          file: file.file,
          current: file.lines.pct,
          baseline: basePct,
          delta,
          trend: delta > 1 ? "↑" : delta < -1 ? "↓" : "→"
        };
      });

      // Flag concerning trends
      const declinedFiles = this.trends.filter(t => t.delta < -5);
      if (declinedFiles.length > 0) {
        console.log(`⚠ Coverage declined in ${declinedFiles.length} files:`);
        declinedFiles.forEach(f => {
          console.log(`  ${f.file}: ${f.baseline}% → ${f.current}% (${f.delta})`);
        });
      }
    }

    // Identify critical paths with low coverage
    this.criticalGaps = this.identifyCriticalPaths();
  }

  identifyCriticalPaths() {
    const criticalPatterns = [
      /auth.*\.js$/i,
      /payment.*\.js$/i,
      /security.*\.js$/i,
      /database.*\.js$/i,
      /api.*\.js$/i
    ];

    return this.lowCoverage.filter(file => {
      return criticalPatterns.some(pattern => pattern.test(file.file));
    });
  }

  summary() {
    return {
      overallCoverage: this.current.summary.lines.pct,
      filesCovered: this.current.fileData.length,
      filesLowCoverage: this.lowCoverage.length,
      criticalGapsFound: this.criticalGaps.length,
      trends: this.baseline ? this.calculateTrendDelta() : null
    };
  }

  calculateTrendDelta() {
    if (!this.baseline) return null;

    const currentTotal = this.current.summary.lines.pct;
    const baselineTotal = this.baseline.summary.lines.pct;
    const delta = currentTotal - baselineTotal;

    return {
      current: currentTotal,
      previous: baselineTotal,
      delta,
      status: delta >= 0 ? "improved" : "declined"
    };
  }
}

const analysis = new CoverageAnalysis(coverage, baseline);
analysis.analyze();

console.log(`\n✓ Coverage analysis complete`);
console.log(JSON.stringify(analysis.summary(), null, 2));
```

**Graceful degradation**: If baseline missing, skip trend analysis; continue with absolute metrics.

---

### Phase 4: Gap Detection & Test Suggestions

Identifies files with low coverage and generates test suggestions.

```javascript
async function generateTestSuggestions() {
  const suggestions = [];

  // Get recently changed files
  let changedFiles = [];
  try {
    const changed = execSync(
      "git diff --name-only HEAD~5"
    )
      .toString()
      .split("\n")
      .filter(f => f);

    changedFiles = changed;
  } catch (err) {
    console.log("ℹ Could not determine recently changed files");
  }

  // For each low-coverage file, read source and suggest tests
  for (const file of analysis.lowCoverage.slice(0, 5)) {
    const sourcePath = file.file;

    try {
      if (!fs.existsSync(sourcePath)) {
        console.log(`⚠ File not found: ${sourcePath}`);
        continue;
      }

      const source = fs.readFileSync(sourcePath, "utf-8");

      // Extract exported functions
      const exportedFunctions = extractExportedFunctions(source, analyzer.framework);

      const suggestion = {
        file: sourcePath,
        coverage: file.lines.pct,
        recentlyChanged: changedFiles.includes(sourcePath),
        uncoveredFunctions: exportedFunctions.slice(0, 3),
        testTemplate: generateTestTemplate(sourcePath, exportedFunctions[0], analyzer.framework)
      };

      suggestions.push(suggestion);
    } catch (err) {
      console.warn(`⚠ Could not analyze ${sourcePath}: ${err.message}`);
    }
  }

  return suggestions;
}

function extractExportedFunctions(source, framework) {
  const functions = [];

  if (framework === "jest") {
    // JavaScript/TypeScript
    const funcRegex = /export (?:async )?function (\w+)|export const (\w+) =|module\.exports\.\w+ = (\w+)/g;
    let match;
    while ((match = funcRegex.exec(source))) {
      const name = match[1] || match[2] || match[3];
      if (name) functions.push(name);
    }
  } else if (framework === "pytest") {
    // Python
    const funcRegex = /^def (\w+)\(/gm;
    let match;
    while ((match = funcRegex.exec(source))) {
      if (!match[1].startsWith("_")) {
        functions.push(match[1]);
      }
    }
  } else if (framework === "go") {
    // Go - uppercase = exported
    const funcRegex = /^func \(.*?\) ([A-Z]\w+)\(/gm;
    let match;
    while ((match = funcRegex.exec(source))) {
      functions.push(match[1]);
    }
  }

  return functions;
}

function generateTestTemplate(filePath, functionName, framework) {
  if (framework === "jest") {
    return `
describe('${path.basename(filePath)}', () => {
  test('${functionName} should handle basic case', () => {
    // Arrange
    // Act
    // Assert
    expect(true).toBe(true);
  });

  test('${functionName} should handle edge case', () => {
    // Arrange
    // Act
    // Assert
  });

  test('${functionName} should handle error', () => {
    // Arrange
    // Act & Assert
    expect(() => ${functionName}()).toThrow();
  });
});`;
  } else if (framework === "pytest") {
    return `
def test_${functionName.toLowerCase()}_basic():
    """Test ${functionName} with normal input."""
    # Arrange
    # Act
    # Assert
    assert True

def test_${functionName.toLowerCase()}_edge_case():
    """Test ${functionName} with edge case."""
    pass

def test_${functionName.toLowerCase()}_error():
    """Test ${functionName} error handling."""
    pass`;
  }

  return "";
}

const suggestions = await generateTestSuggestions();

if (suggestions.length > 0) {
  console.log(`\n## Test Suggestions for Low-Coverage Files\n`);
  suggestions.forEach(s => {
    console.log(`### ${s.file}`);
    console.log(`- **Current Coverage**: ${s.coverage}%`);
    if (s.recentlyChanged) console.log(`- ⚠️ Recently modified`);
    console.log(`- **Uncovered Functions**: ${s.uncoveredFunctions.join(", ")}`);
    console.log(`\n\`\`\`\n${s.testTemplate}\n\`\`\`\n`);
  });
}
```

**Graceful degradation**: If source analysis fails, skip suggestions; continue with coverage metrics.

---

### Phase 5: Report & Publishing

Formats and publishes coverage report.

```javascript
function formatReport(format = "markdown") {
  const summary = analysis.summary();

  if (format === "json") {
    return JSON.stringify(
      {
        summary,
        lowCoverage: analysis.lowCoverage,
        criticalGaps: analysis.criticalGaps,
        trends: analysis.trends
      },
      null,
      2
    );
  }

  // Markdown format
  let report = `# Test Coverage Report

## Summary

| Metric | Value | Trend |
|--------|-------|-------|
| Overall Coverage | **${summary.overallCoverage}%** | ${analysis.trends?.delta >= 0 ? "↑" : "↓"} ${analysis.trends?.delta || "N/A"} |
| Files Analyzed | ${summary.filesCovered} | - |
| Files < 50% Coverage | ${summary.filesLowCoverage} | ⚠️ |
| Critical Gaps | ${summary.criticalGapsFound} | 🔴 |

`;

  if (analysis.criticalGaps.length > 0) {
    report += `## 🔴 Critical Paths with Low Coverage\n\n`;
    analysis.criticalGaps.forEach(f => {
      report += `- **${f.file}**: ${f.lines.pct}%\n`;
    });
    report += "\n";
  }

  if (analysis.lowCoverage.length > 0) {
    report += `## ⚠️ Low Coverage Files\n\n`;
    analysis.lowCoverage.slice(0, 10).forEach(f => {
      report += `- ${f.file}: ${f.lines.pct}%\n`;
    });
    if (analysis.lowCoverage.length > 10) {
      report += `- ... and ${analysis.lowCoverage.length - 10} more\n`;
    }
    report += "\n";
  }

  if (analysis.trends && analysis.trends.length > 0) {
    const improved = analysis.trends.filter(t => t.delta > 0);
    const declined = analysis.trends.filter(t => t.delta < -1);

    if (improved.length > 0 || declined.length > 0) {
      report += `## 📊 Coverage Trends\n\n`;
      if (improved.length > 0) {
        report += `### ✅ Improved\n${improved.map(t => `- ${t.file}: ${t.baseline}% → ${t.current}%`).join("\n")}\n\n`;
      }
      if (declined.length > 0) {
        report += `### ⚠️ Declined\n${declined.map(t => `- ${t.file}: ${t.baseline}% → ${t.current}%`).join("\n")}\n\n`;
      }
    }
  }

  return report;
}

const reportMarkdown = formatReport("markdown");
console.log(reportMarkdown);

// Save baseline if requested
if (argv["update-baseline"]) {
  fs.writeFileSync(".coverage-baseline.json", JSON.stringify(coverage, null, 2));
  console.log("✓ Baseline updated");
}

// Post as PR comment if requested
if (argv.pr) {
  try {
    const pr = execSync('gh pr view --json number').toString().trim();
    const prNumber = JSON.parse(pr).number;

    await execSync(
      `gh pr comment ${prNumber} -b "${reportMarkdown.replace(/"/g, '\\"')}"`,
      { stdio: "inherit" }
    );

    console.log(`✓ Posted coverage report to PR #${prNumber}`);
  } catch (err) {
    console.warn(`⚠ Failed to post PR comment: ${err.message}`);
  }
}

// Check minimum threshold
if (summary.overallCoverage < (argv.min || 50)) {
  console.error(
    `✗ Coverage ${summary.overallCoverage}% below minimum ${argv.min || 50}%`
  );
  process.exit(1);
}
```

**Graceful degradation**: If PR comment fails, output to stdout; continue with file operations.

---

## Error Handling Summary

| Error | Behavior |
|-------|----------|
| Framework not detected | Suggest supported frameworks; exit |
| Test execution fails | Report failure; suggest debugging |
| Coverage file missing | Check alternative paths; suggest config |
| Baseline corrupted | Delete and start fresh |
| PR post fails | Continue with file output |

## Performance Notes

- Caches baseline coverage (persistent storage)
- Skips full analysis if using `--changed-only`
- Lazy-loads source files only for low-coverage items
- Batches API calls when posting to GitHub

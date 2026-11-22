import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// Shared state used by the scatterplot and brushing code
let xScale;
let yScale;
let brushSelection = null;

const width = 1000;
const height = 600;
const margin = { top: 10, right: 10, bottom: 40, left: 50 };
const usable = {
  left: margin.left,
  right: width - margin.right,
  top: margin.top,
  bottom: height - margin.bottom,
  width: width - margin.left - margin.right,
  height: height - margin.top - margin.bottom,
};

const languageNames = { css: "CSS", html: "HTML", js: "JavaScript" };

// Step 1.1: turn numeric fields into numbers and dates into Date objects
function rowConverter(row) {
  return {
    file: row.file,
    line: Number(row.line),
    type: row.type,
    commit: row.commit,
    author: row.author,
    time: row.time,
    datetime: new Date(row.datetime),
    depth: Number(row.depth),
    length: Number(row.length),
  };
}

// "13:34:24" -> 13.567 (hours as a fraction)
function hourFraction(time) {
  let [hours, minutes] = time.split(":").map(Number);
  return hours + minutes / 60;
}

const data = await d3.csv("loc.csv", rowConverter);

// every commit in the repo, generated with: git log --format=%h,%aI
const allCommits = await d3.csv("commits.csv");

// Step 1.2: group lines by commit and build a commits array
const commits = d3.groups(data, (d) => d.commit).map(([id, lines]) => {
  let first = lines[0];
  let commit = {
    id,
    url: `https://github.com/thinhdodata/portfolio/commit/${id}`,
    author: first.author,
    datetime: first.datetime,
    time: first.time,
    hourFrac: hourFraction(first.time),
    totalLines: lines.length,
  };
  // keep the original lines available without showing them as a normal property
  Object.defineProperty(commit, "lines", { value: lines, enumerable: false });
  return commit;
});

// Step 3.2: put commits in date order (oldest first)
commits.sort((a, b) => a.datetime - b.datetime);

// Step 1.1: time slider
let commitProgress = 100;

const timeScale = d3
  .scaleTime()
  .domain(d3.extent(commits, (d) => d.datetime))
  .range([0, 100]);

let commitMaxTime = timeScale.invert(commitProgress);

const slider = document.querySelector("#commit-progress");
const timeOutput = document.querySelector("#commit-time");

// Step 1.2: filter commits and update the existing plot
let filteredCommits = commits;

function onTimeSliderChange() {
  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);

  timeOutput.textContent = commitMaxTime.toLocaleString("en", {
    dateStyle: "long",
    timeStyle: "short",
  });

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  updateScatterPlot(filteredCommits);
  
  updateFileDisplay(filteredCommits);
}

function updateScatterPlot(data) {
  // The x-axis follows the visible commits
  xScale.domain(d3.extent(data, (d) => d.datetime));

  // Clear and redraw the x-axis
  const xAxisGroup = svg.select(".x-axis");
  xAxisGroup.selectAll("*").remove();
  xAxisGroup.call(d3.axisBottom(xScale));

  // Move the existing circles and hide the ones after the slider date
  dots
    .attr("cx", (d) => xScale(d.datetime))
    .style("display", (d) => (d.datetime <= commitMaxTime ? null : "none"));
}
// Step 2.4: one color per file type (css, html, js)
const techColor = d3.scaleOrdinal(d3.schemeTableau10);
// Step 2.1: list of files and their line counts
function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap((d) => d.lines);

  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }));

  files.sort((a, b) => b.lines.length - a.lines.length);
  
  const rows = d3
    .select("#files")
    .selectAll("div")
    .data(files, (d) => d.name)
    .join((enter) => {
      const row = enter.append("div");
      row.append("dt").append("code");
      row.append("dd");
      return row;
    });

  rows.order();

  rows.select("dt code").text((d) => d.name);
  rows
  .select("dd")
  .selectAll("div.loc")
  .data((d) => d.lines)
  .join("div")
  .attr("class", "loc")
  .style("--color", (d) => techColor(d.type));
}

// Step 3.2: one text block per commit in the left column
function renderStory() {
  d3.select("#scatter-story")
    .selectAll("div.step")
    .data(commits)
    .join("div")
    .attr("class", "step")
    .html((d, i) => {
      const date = d.datetime.toLocaleString("en", {
        dateStyle: "full",
        timeStyle: "short",
      });
      const fileCount = new Set(d.lines.map((l) => l.file)).size;
      return `
        <p>
          On ${date}, I made
          <a href="${d.url}" target="_blank">${i === 0 ? "my first commit" : "another commit"}</a>,
          editing ${d.totalLines} lines across ${fileCount} files.
        </p>`;
    });
}

renderStory();

// Step 1.3: summary stats
const busiest = d3.greatest(
  d3.rollup(
    commits,
    (v) => v.length,
    (d) => Math.floor(d.hourFrac),
  ),
  (d) => d[1],
);

document.querySelector("#stats").innerHTML = `
  <div><dt>Total lines</dt><dd>${data.length}</dd></div>
  <div><dt>Total commits</dt><dd>${allCommits.length}</dd></div>
  <div><dt>Commits with live code</dt><dd>${commits.length}</dd></div>
  <div><dt>Code files</dt><dd>${new Set(data.map((d) => d.file)).size}</dd></div>
  <div><dt>Avg lines per commit</dt><dd>${Math.round(d3.mean(commits, (d) => d.totalLines))}</dd></div>
  <div><dt>Busiest hour</dt><dd>${String(busiest[0]).padStart(2, "0")}:00</dd></div>
`;

// Step 2: scatterplot with time of day (Y) and commit date (X)
xScale = d3
  .scaleTime()
  .domain(d3.extent(commits, (d) => d.datetime))
  .range([usable.left, usable.right])
  .nice();

yScale = d3
  .scaleLinear()
  .domain([0, 24])
  .range([usable.bottom, usable.top]);

const svg = d3.select("#chart").attr("viewBox", `0 0 ${width} ${height}`);

// subtle horizontal gridlines
svg
  .append("g")
  .attr("class", "gridlines")
  .attr("transform", `translate(${usable.left}, 0)`)
  .call(
    d3
      .axisLeft(yScale)
      .tickValues(d3.range(0, 25, 2))
      .tickSize(-usable.width)
      .tickFormat(""),
  );

svg
  .append("g")
  .attr("class", "y-axis")
  .attr("transform", `translate(${usable.left}, 0)`)
  .call(
    d3
      .axisLeft(yScale)
      .tickValues(d3.range(0, 25, 2))
      .tickFormat((d) => `${String(d).padStart(2, "0")}:00`),
  );

svg
  .append("g")
  .attr("class", "x-axis")
  .attr("transform", `translate(0, ${usable.bottom})`)
  .call(d3.axisBottom(xScale));

// Step 5.1: brush goes first so the dots can sit above it
const brush = d3
  .brush()
  .extent([
    [usable.left, usable.top],
    [usable.right, usable.bottom],
  ])
  .on("start brush end", brushed);

svg.append("g").attr("class", "brush").call(brush);

// Step 4: dot area proportional to lines edited
const rScale = d3
  .scaleSqrt()
  .domain(d3.extent(commits, (d) => d.totalLines))
  .range([2, 30]);

const colorScale = d3.scaleSequential(d3.interpolateCool).domain([0, 24]);

// sort largest first so smaller dots end up on top
const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

// dots are appended after the brush, so they are raised above it
const dots = svg
  .append("g")
  .attr("class", "dots")
  .selectAll("circle")
  .data(sortedCommits, (d) => d.id)
  .join("circle")
  .attr("cx", (d) => xScale(d.datetime))
  .attr("cy", (d) => yScale(d.hourFrac))
  .attr("r", (d) => rScale(d.totalLines))
  .attr("fill", (d) => colorScale(d.hourFrac));

// Step 3: tooltip (lines = lines from this commit still in the code)
const tooltip = document.querySelector("#commit-tooltip");

function updateTooltipVisibility(isVisible) {
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  tooltip.style.left = `${event.clientX + 15}px`;
  tooltip.style.top = `${event.clientY + 15}px`;
}

function updateTooltipContent(commit) {
  if (!commit) return;
  let link = document.querySelector("#tt-link");
  link.href = commit.url;
  link.textContent = commit.id;
  document.querySelector("#tt-date").textContent = d3.timeFormat("%B %-d, %Y")(
    commit.datetime,
  );
  document.querySelector("#tt-time").textContent = commit.time;
  document.querySelector("#tt-author").textContent = commit.author;
  document.querySelector("#tt-lines").textContent = commit.totalLines;
}

dots
  .on("mouseenter", (event, d) => {
    updateTooltipContent(d);
    updateTooltipVisibility(true);
    updateTooltipPosition(event);
  })
  .on("mousemove", (event) => updateTooltipPosition(event))
  .on("mouseleave", () => updateTooltipVisibility(false));

// Step 5.3: check whether a commit's point falls inside the brush box
function isCommitSelected(commit) {
  if (!brushSelection) return false;
  if (commit.datetime > commitMaxTime) return false; // hidden by the slider
  let [[x0, y0], [x1, y1]] = brushSelection;
  let x = xScale(commit.datetime);
  let y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

// Step 5.2 and 5.4: highlight selected dots and summarize them
function brushed(event) {
  brushSelection = event.selection;
  dots.classed("selected", (d) => isCommitSelected(d));
  renderSelectionSummary();
}

function renderSelectionSummary() {
  let selected = commits.filter(isCommitSelected);

  document.querySelector("#selection-count").textContent =
    selected.length === 0
      ? "No commits selected. Drag across the plot to select some."
      : `${selected.length} commit${selected.length === 1 ? "" : "s"} selected`;

  let container = document.querySelector("#language-breakdown");
  let lines = selected.flatMap((d) => d.lines);

  if (lines.length === 0) {
    container.innerHTML = "";
    return;
  }

  let counts = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );
  let format = d3.format(".1%");

  let items = Array.from(counts, ([type, count]) => ({
    type,
    count,
    share: count / lines.length,
  })).sort((a, b) => b.count - a.count);

  container.innerHTML = `
    <dl class="breakdown">
      ${items
        .map(
          (item) => `
        <div>
          <dt>${languageNames[item.type] ?? item.type}</dt>
          <dd>${item.count} lines (${format(item.share)})</dd>
        </div>`,
        )
        .join("")}
    </dl>
  `;
}

renderSelectionSummary();

// Step 1.2: connect the slider and draw the initial state
slider.addEventListener("input", onTimeSliderChange);
onTimeSliderChange();

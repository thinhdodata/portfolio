import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { fetchJSON, renderProjects } from "../global.js";

let query = "";

let selectedYear = null;

function applyFilters() {
  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join("\n").toLowerCase();

    let matchesSearch = values.includes(query);

    let matchesYear = selectedYear === null || project.year === selectedYear;

    return matchesSearch && matchesYear;
  });

  renderProjects(filteredProjects, projectsContainer, "h2");

  renderPieChart(
    projects.filter((project) => {
      let values = Object.values(project).join("\n").toLowerCase();
      return values.includes(query);
    }),
  );
}

const projects = await fetchJSON("../lib/projects.json");
const projectsContainer = document.querySelector(".projects");
renderProjects(projects, projectsContainer, "h2");

// Step 1.6: show the project count in the heading
const projectsTitle = document.querySelector(".projects-title");
if (projectsTitle) {
  projectsTitle.textContent = `${projects.length} Projects`;
}

renderPieChart(projects);

function renderPieChart(projectsGiven) {
  d3.select("#projects-pie-plot").selectAll("path").remove();
  d3.select(".legend").selectAll("li").remove();

  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );

  let data = rolledData.map(([year, count]) => {
    return { value: count, label: year };
  });

  let sliceGenerator = d3.pie().value((d) => d.value);
  let arcData = sliceGenerator(data);
  let arcs = arcData.map((d) => arcGenerator(d));

  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  arcs.forEach((arc, idx) => {
    d3.select("#projects-pie-plot")
      .append("path")
      .attr("d", arc)
      .attr("fill", colors(idx))
      .attr("class", data[idx].label === selectedYear ? "selected" : "")
      .on("click", () => {
        selectedYear =
          selectedYear === data[idx].label ? null : data[idx].label;

        applyFilters();
      });
  });

  let legend = d3.select(".legend");
  data.forEach((d, idx) => {
    legend
      .append("li")
      .attr("style", `--color:${colors(idx)}`)
      .attr("class", d.label === selectedYear ? "selected" : "")
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

let searchInput = document.querySelector(".searchBar");
searchInput.addEventListener("input", (event) => {
  query = event.target.value.toLowerCase();
  applyFilters();
});

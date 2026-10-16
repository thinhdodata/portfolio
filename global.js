console.log("IT’S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Step 3: build the nav menu automatically

// 3.1 list of pages (one place to edit the menu)
let pages = [
  { url: "", title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/", title: "Contact" },
  { url: "resume/", title: "Resume" },
  { url: "https://github.com/thinhdodata", title: "GitHub" },
];

// root of the site: "/" on Live Server, "/portfolio/" on GitHub Pages
const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"
    : "/portfolio/";

// create <nav> and put it at the top of <body>
let nav = document.createElement("nav");
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  // internal links get the base path, external links stay as-is
  if (!url.startsWith("http")) {
    url = BASE_PATH + url;
  }

  // 3.2 build the link as an element
  let a = document.createElement("a");
  a.href = url;
  a.textContent = title;
  nav.append(a);

  // highlight the current page
  a.classList.toggle(
    "current",
    a.host === location.host && a.pathname === location.pathname,
  );

  // open external links in a new tab
  if (a.host !== location.host) {
    a.target = "_blank";
  }
}

// Step 4: theme switcher
document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>`,
);

let select = document.querySelector(".color-scheme select");

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty("color-scheme", colorScheme);
  select.value = colorScheme;
}

if ("colorScheme" in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

select.addEventListener("input", function (event) {
  console.log("color scheme changed to", event.target.value);
  setColorScheme(event.target.value);
  localStorage.colorScheme = event.target.value;
});

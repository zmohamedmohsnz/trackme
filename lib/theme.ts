export const THEME_STORAGE_KEY = "trackme-theme";

export const THEME_INITIALIZATION_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})()`;

export type Theme = "light" | "dark";

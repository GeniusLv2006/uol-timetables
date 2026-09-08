import { cp, mkdir, rm } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const outputDirectory = new URL("../dist/", import.meta.url);

const files = ["index.html", "styles.css", "timetable.sample.json", "_headers"];
const directories = ["assets", "js", "styles"];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of files) {
  await cp(new URL(file, projectRoot), new URL(file, outputDirectory));
}

for (const directory of directories) {
  await cp(new URL(`${directory}/`, projectRoot), new URL(`${directory}/`, outputDirectory), {
    recursive: true,
  });
}

console.log("Built a static deployment bundle in dist/.");

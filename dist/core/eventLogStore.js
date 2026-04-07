import fs from "node:fs";
export function createInMemoryEventLogStore() {
    const events = [];
    return {
        append(event) {
            events.push(event);
        },
        getAll() {
            return events;
        }
    };
}
export function createJsonlEventLogStore(filePath) {
    return {
        append(event) {
            fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
        },
        getAll() {
            if (!fs.existsSync(filePath)) {
                return [];
            }
            const lines = fs
                .readFileSync(filePath, "utf8")
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.length > 0);
            return lines.map((line) => JSON.parse(line));
        }
    };
}

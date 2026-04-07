export function select(frontier, policy) {
    if (frontier.length === 0) {
        return undefined;
    }
    if (policy === "dfs") {
        return frontier[frontier.length - 1];
    }
    return frontier[0];
}

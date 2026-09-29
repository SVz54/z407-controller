// Accept action pages at the site root or under a GitHub repository path.
export function actionFromPath(pathname) {
 const match=pathname.match(/\/bass-(up|down)(?:\.html)?\/?$/);
 return match ? match[1] : null;
}

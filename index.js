/** Copyright (c) 2017 Uber Technologies, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = robot => {
  robot.on('pull_request.created', commentOnPr);
  robot.on('pull_request.synchronize', commentOnPr);
  robot.on('pull_request.labeled', commentOnPr);

  async function commentOnPr(context) {
    const pr = context.payload.pull_request;
    const repo = context.payload.repository;

    const {github} = context;
    const labels = await github.issues.getIssueLabels(context.issue());

    const isRelease = labels.data.some(
      label => label.name.toLowerCase() === 'release',
    );

    if (!isRelease) {
      return;
    }

    const shaToReleaseTagName = await fetchAllReleases(context);
    const parentReleaseTagName = await findParentRelease(
      context,
      pr.base.sha,
      shaToReleaseTagName,
    );

    const base = parentReleaseTagName || pr.base.label;
    const head = pr.head.label;
    const compareUrl = `${repo.html_url}/compare/${base}...${head}`;

    github.issues.createComment(
      context.issue({
        body: compareUrl,
      }),
    );
  }
};

async function fetchAllReleases(context, handler = () => {}) {
  const {github} = context;

  const releasesBySha = new Map();

  const req = github.repos.getReleases(
    context.repo({
      per_page: 100,
    }),
  );
  await fetchPages(github, req, results => {
    results.data.forEach(release => {
      // TODO: don't assume target_commitish is sha
      releasesBySha.set(release.target_commitish, release);
      handler(release);
    });
  });
  return releasesBySha;
}

async function findParentRelease(context, sha, shaToReleaseTagName) {
  const {github} = context;

  let req = github.repos.getCommits(
    context.repo({
      sha,
      per_page: 100,
    }),
  );

  let releaseTagName;

  await fetchPages(github, req, commits => {
    for (let commit of commits.data) {
      if (shaToReleaseTagName.has(commit.sha)) {
        releaseTagName = shaToReleaseTagName.get(commit.sha).tag_name;
        return true;
      }
    }
  });

  return releaseTagName;
}

async function fetchPages(github, pageReq, pageHandler) {
  while (pageReq) {
    const page = await pageReq;
    const stopEarly = await pageHandler(page);
    pageReq =
      !stopEarly && github.hasNextPage(page)
        ? github.getNextPage(page)
        : void 0;
  }
}

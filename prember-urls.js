const { readdirSync, readFileSync } = require('fs');
const cmp = require('semver-compare');
const semver = require('semver');

function partialUrlEncode(input) {
  return input.replace('/', '%2F');
}

module.exports = function () {
  const projects = readdirSync('ember-api-docs-data/json-docs');

  const urls = [];

  projects.forEach((p) => {
    // add release for each of the projects
    urls.push(`/${p}/release`);

    const fullProjectVersions = readdirSync(
      `ember-api-docs-data/json-docs/${p}`
    ).filter((v) => v.match(/\d+\.\d+\.\d+/));

    // add landing page for each of the projects versions
    const projectVersions = fullProjectVersions.map((v) => {
      let [, major, minor] = v.match(/(\d+)\.(\d+)\.\d+/);
      return `${major}.${minor}`;
    }); // uniq

    const uniqueProjectVersions = [...new Set(projectVersions)];

    const oldVersions = [
      '1.12',
      '1.13',
      '2.17',
      '2.18',
      '3.4',
      '3.8',
      '3.12',
      '3.16',
      '3.20',
      '3.24',
      '3.27',
      '3.28',
    ];

    uniqueProjectVersions.forEach((uniqVersion) => {
      if (
        !oldVersions.includes(uniqVersion) &&
        !semver.gte(`${uniqVersion}.0`, '4.0.0')
      ) {
        return;
      }

      urls.push(`/${p}/${uniqVersion}`);

      const sortedPatchVersions = fullProjectVersions
        .filter((projectVersion) => {
          // console.log("comparing", projectVersion, uniqVersion, semver.satisfies(projectVersion, uniqVersion))
          return semver.satisfies(projectVersion, uniqVersion);
        })
        .sort(cmp);

      const highestPatchVersion =
        sortedPatchVersions[sortedPatchVersions.length - 1];

      const revIndex = require(`${__dirname}/ember-api-docs-data/rev-index/${p}-${highestPatchVersion}.json`);

      ['classes', 'namespaces', 'modules'].forEach((entity) => {
        // add classes
        revIndex.data.relationships[entity].data.forEach(({ id }) => {
          const [, cleanId] = id.match(/^.+-\d+\.\d+\.\d+-(.*)/);
          urls.push(
            `/${p}/${uniqVersion}/${entity}/${partialUrlEncode(cleanId)}`
          );

          // TODO only include sub routes if that entity has stuff in that route i.e. if it's empty don't pre-render it
          urls.push(
            `/${p}/${uniqVersion}/${entity}/${partialUrlEncode(
              cleanId
            )}/methods`
          );
          urls.push(
            `/${p}/${uniqVersion}/${entity}/${partialUrlEncode(
              cleanId
            )}/properties`
          );
          urls.push(
            `/${p}/${uniqVersion}/${entity}/${partialUrlEncode(cleanId)}/events`
          );

          if (entity === 'modules') {
            const moduleKey = id;

            const fileName = revIndex.meta.module[moduleKey];

            if (fileName === undefined) {
              // rare cases when very strange things make it through this far
              // e.g. ember-3.0.0-ember%0A%0ARemove%20after%203.4%20once%20_ENABLE_RENDER_SUPPORT%20flag%20is%20no%20longer%20needed.
              // 🤷‍♀️
              return;
            }

            const moduleData = require(`${__dirname}/ember-api-docs-data/json-docs/${p}/${highestPatchVersion}/modules/${fileName}.json`);

            const staticFunctions = moduleData.data.attributes.staticfunctions;

            Object.keys(staticFunctions).forEach((k) => {
              const listOfFunctions = staticFunctions[k];

              listOfFunctions.forEach((func) => {
                urls.push(
                  `/${p}/${uniqVersion}/functions/${encodeURIComponent(
                    func.class
                  )}/${func.name}`
                );
              });
            });
          }

          // TODO review that we have got all the URLs that we care about

          // TODO discuss only prembering "supported" versions - maybe last version in a major and supported versions
          // alternative is to rely on netlify complex build
        });
      });
    });
  });

  return urls;
};

// this is useful to debug why a url isn't being prembered
// DEBUG=prember-urls node prember-urls.js
if (process.env.DEBUG === 'prember-urls') {
  let urls = module.exports();

  urls.forEach((url) => console.log(url));

  console.log(`\n${urls.length} total URLs`);
}

const { htm } = require('@zeit/integration-utils');
const { ROOT_URL } = process.env;

const getBackgroundImageBox = (
  url,
  width = 40,
  height = 40,
  display = 'block'
) =>
  htm`<Box display=${display} backgroundImage=${'url(' +
    url +
    ')'} width=${width + 'px'} height=${height +
    'px'} backgroundSize="cover" />`;

module.exports = {
  apiClient(zeitClient) {
    return {
      async getDeployments(projectId) {
        return await zeitClient.fetchAndThrow(
          `/v4/now/deployments?limit=100&projectId=${projectId}`,
          {
            method: 'GET'
          }
        );
      },
      async getDeploymentById(id) {
        return await zeitClient.fetchAndThrow(`/v9/now/deployments/${id}`, {
          method: 'GET'
        });
      },
      async getDeploymentBuilds(id) {
        return await zeitClient.fetchAndThrow(
          `/v5/now/deployments/${id}/builds`,
          {
            method: 'GET'
          }
        );
      },
      async getDeploymentLogs(id) {
        return await zeitClient.fetchAndThrow(
          `/v2/now/deployments/${id}/events`,
          {
            method: 'GET'
          }
        );
      }
    };
  },
  transformLogLine(text, date) {
    let newText = text.replace(/\033\[[0-9;]*m/g, '');

    // structure reports
    if (newText.includes('REPORT RequestId:')) {
      const splitValues = newText
        .replace('REPORT ', '')
        .replace(/\n/g, '')
        .split('\t');
      const structuredReport = splitValues
        .map(v => {
          const [key, value] = v.split(':');

          if (key && value) {
            return {
              key: key.trim(),
              value: value.trim()
            };
          }
        })
        .filter(k => !!k);

      return htm`<Box padding="10px" position="relative" marginBottom="10px" backgroundColor="#1f1f1f" borderRadius="5px">
        <Box position="absolute" right="10px" top="10px" color="#666">${date}</Box>
      ${structuredReport.map(
        rep => htm`<Box><B>${rep.key}:</B> ${rep.value}</Box>`
      )}</Box>`;
    }

    const colorStartWord = (text, link = '') => {
      const colors = {
        info: '#0076FF',
        warning: '#FF0000',
        'WARNING:': '#FF0000',
        success: '#2CBE4E',
        Done: '#2CBE4E',
        'MODE:': '#FF0080'
      };
      let word = '';

      Object.keys(colors).forEach(color => {
        if (text.startsWith(color)) {
          word = color;
        }
      });
      const rText = text.replace(word + ' ', '');
      const textBr = rText.split('\n');

      return htm`<Box display="flex">
        <Box marginRight="20px" color="#666">${date}</Box>
        <Box>
            ${
              word
                ? htm`<Box color=${
                    colors[word]
                  } display="inline"><B>${word}</B></Box>`
                : ''
            }
            ${
              link !== ''
                ? htm`<Link target="_blank" href=${link}>
              <Box display="inline" textDecoration="underline" color="#888888">${
                textBr.length ? textBr.map(te => htm`${te}<BR />`) : rText
              }</Box>
            </Link>`
                : htm`<Box display="inline">${
                    textBr.length ? textBr.map(te => htm`${te}<BR />`) : rText
                  }</Box>`
            }
        </Box>
      </Box>`;
    };

    //asset size limit:

    if (newText.match(/Creating lambda for page: \"(.*)\"/)) {
      const [text, file] = newText.match(/Creating lambda for page: \"(.*)\"/);
      return htm`<Box display="flex">
        <Box marginRight="20px" color="#666">${date}</Box>
        <Box>
          ${getBackgroundImageBox(
            ROOT_URL + '/lambda.svg',
            20,
            15,
            'inline-block'
          )}
          <Box display="inline-block">Creating lambda for page: <B>${file}</B></Box>
        </Box>
      </Box>`;
    }

    if (newText.match(/Created lambda for page: \"(.*)\"/)) {
      const [text, file] = newText.match(/Created lambda for page: \"(.*)\"/);
      return htm`<Box display="flex">
        <Box marginRight="20px" color="#666">${date}</Box>
        <Box>
          ${getBackgroundImageBox(
            ROOT_URL + '/lambda.svg',
            20,
            15,
            'inline-block'
          )}
          <Box display="inline-block">Created lambda for page: <B>${file}</B></Box>
        </Box>
      </Box>`;
    }

    if (newText.includes('No license field')) {
      return colorStartWord(
        newText,
        'https://docs.npmjs.com/files/package.json#license'
      );
    }

    if (newText.includes('No repository field')) {
      return colorStartWord(
        newText,
        'https://docs.npmjs.com/files/package.json#repository'
      );
    }

    if (newText.includes('No lockfile found')) {
      return colorStartWord(
        newText,
        'https://yarnpkg.com/lang/en/docs/yarn-lock/'
      );
    }

    if (newText.startsWith('normalized package.json result:')) {
      const pkgJson = newText.replace('normalized package.json result:', '');

      const d = JSON.parse(JSON.stringify(pkgJson, undefined, 2));

      return htm`<Box display="flex">
      <Box marginRight="20px" color="#666">${date}</Box>
      <Box>
        <Box>normalized package.json result:</Box>
        <Code>${d}</Code>
      </Box>
    </Box>`;
    }

    if (newText.startsWith('info')) {
      return colorStartWord(newText);
    }
    if (newText.startsWith('MODE:')) {
      return colorStartWord(newText);
    }
    if (newText.startsWith('warning') || newText.startsWith('WARNING:')) {
      return colorStartWord(newText);
    }
    if (newText.startsWith('success') || newText.startsWith('Done')) {
      return colorStartWord(newText);
    }

    newText = newText.split('\n');
    return htm`<Box display="flex">
      <Box marginRight="20px" color="#666">${date}</Box>
      <Box>${
        newText.length > 1 ? newText.map(te => htm`${te}<BR />`) : text
      }</Box>
    </Box>

    `;
  },
  isImage(file) {
    return (
      file.includes('.png') ||
      file.includes('.jpg') ||
      file.includes('.jpeg') ||
      file.includes('.gif')
    );
  },
  getBackgroundImageBox,
  getIconByFile(file, width = 40, height = 40) {
    let isMap = false;
    let ext = file;
    if (ext.includes('.map')) {
      ext = ext.replace(/\.map/g, '-map');
    }

    ext = ext.split('.');

    if (ext.length > 1) {
      return getBackgroundImageBox(
        ROOT_URL + '/' + ext.pop() + '.svg',
        width,
        height
      );
    }
    return '';
  }
};

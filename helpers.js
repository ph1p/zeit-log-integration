const { htm } = require('@zeit/integration-utils');
const HOST = 'http://localhost:5005';

const getBackgroundImageBox = (url, width = 40, height = 40) =>
  htm`<Box backgroundImage=${'url(' + url + ')'} width=${width +
    'px'} height=${height + 'px'} backgroundSize="cover" />`;

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
        Done: '#2CBE4E'
      };
      let word = '';

      Object.keys(colors).forEach(color => {
        if (text.startsWith(color)) {
          word = color;
        }
      });

      return htm`<Box display="flex">
        <Box marginRight="20px" color="#666">${date}</Box>
        <Box>
            ${
              word
                ? htm`<Box color=${colors[word]} display="inline">${word}</Box>`
                : ''
            }
            ${
              link !== ''
                ? htm`<Link target="_blank" href=${link}>
              <Box display="inline" textDecoration="underline" color="#888888"><B>${text.replace(
                word + ' ',
                ''
              )}</B></Box>
            </Link>`
                : htm`<Box display="inline"><B>${text.replace(
                    word + ' ',
                    ''
                  )}</B></Box>`
            }
        </Box>
      </Box>`;
    };

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
      console.log(newText);
    }

    if (newText.startsWith('info')) {
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
      <Box>${newText.length ? newText.map(te => htm`${te}<BR />`) : text}</Box>
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
        HOST + '/' + ext.pop() + '.svg',
        width,
        height
      );
    }
    return '';
  }
};

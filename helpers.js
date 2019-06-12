const { htm: html } = require('@zeit/integration-utils');
const { parse, format } = require('date-fns');
const { ROOT_URL } = process.env;

const getBackgroundImageBox = (
  url,
  width = 40,
  height = 40,
  display = 'block'
) =>
  html`
    <Box
      display=${display}
      backgroundImage=${'url(' + url + ')'}
      width=${width + 'px'}
      height=${height + 'px'}
      backgroundSize="cover"
    />
  `;

const colorStartWord = (text, link = '') => {
  const colors = {
    info: '#0076FF',
    warning: '#F5A623',
    'WARNING:': '#F5A623',
    success: '#2CBE4E',
    done: '#2CBE4E',
    'MODE:': '#FF0080'
  };
  let word = '';

  Object.keys(colors).forEach(color => {
    if (
      text
        .toLowerCase()
        .trim()
        .startsWith(color)
    ) {
      word = color;
    }
  });
  const rText = text.trim().replace(new RegExp(word, 'i'), '');
  const textBr = rText.split('\n');

  return html`
    ${word
      ? html`
          <Box color=${colors[word]} display="inline"><B>${word}</B></Box>
        `
      : ''}
    ${link !== ''
      ? html`<Link target="_blank" href=${link}>
            <Box display="inline" textDecoration="underline" color="#888888">${
              textBr.length
                ? textBr.map(
                    te =>
                      html`
                        ${te}<BR />
                      `
                  )
                : rText
            }</Box>
          </Link>`
      : html`
          <Box display="inline"
            >${textBr.length
              ? textBr.map(
                  te =>
                    html`
                      ${te}<BR />
                    `
                )
              : rText}</Box
          >
        `}
  `;
};
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
  compressLogs(logs) {
    if (logs) {
      const logsDate = {};

      logs.forEach(log => {
        const { info, text, date } = log.payload;
        const { type, entrypoint, path, name } = info;

        let arr = logsDate[format(parse(date), 'MM.DD.YYYY | H:mm:ss')];

        if (!arr) {
          arr = logsDate[format(parse(date), 'MM.DD.YYYY | H:mm:ss')] = [];
        }

        arr.push(log);
      });

      return logsDate;
    }
    return null;
  },
  transformLogLine(text) {
    let logText = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();

    if (logText.startsWith('normalized package.json result:')) {
      const pkgJson = logText.replace('normalized package.json result:', '');

      const d = JSON.parse(JSON.stringify(pkgJson, undefined, 2));

      return html`
        <Box>normalized package.json result:</Box>
        <Code>${d}</Code>
      `;
    }

    return logText.split('\n').map(currentText => {
      // structure reports
      if (
        currentText.includes('REPORT RequestId:') ||
        currentText.includes('START RequestId:') ||
        currentText.includes('END RequestId:')
      ) {

        const type = currentText.match(/\w+[^\s]/)[0]

        currentText = currentText
          .replace(/\n/g, '|')
          .replace(/\t/g, '|')
          .replace(/\w+[^\s]/, '')
          .trim()
          .replace(/:\s/g, ':')
          .split('|');

        if (currentText.length === 1) {
          currentText = currentText.join('|').split(' ');
        }

        structuredReport = currentText.map(str => {
          const [key, value] = str.split(':');

          return { key, value };
        });

        //   <Box position="absolute" right="10px" top="10px" color="#666"
        //   >${date}</Box
        // >
        return html`
          <Box
            padding="10px"
            position="relative"
            marginBottom="10px"
            backgroundColor="#1f1f1f"
            borderRadius="5px"
            width="100%"
          >
            <Box position="absolute" right="10px" top="10px" color="#666">
              ${type}
            </Box>
            ${structuredReport.map(
              rep =>
                html`
                  <Box><B>${rep.key + ':'}</B> ${rep.value}</Box>
                `
            )}</Box
          >
        `;
      }

      //asset size limit:

      if (currentText.startsWith('TaskID')) {
        const [title, text] = currentText.split(' ');

        return html`
          <B>${title + ':'}</B> ${text}
        `;
      }

      if (currentText.match(/Creating lambda for page: \"(.*)\"/)) {
        const [_, file] = currentText.match(
          /Creating lambda for page: \"(.*)\"/
        );
        return html`
          <Box display="flex">
            ${getBackgroundImageBox(
              ROOT_URL + '/lambda.svg',
              20,
              15,
              'inline-block'
            )}
            <Box display="inline-block">
              Creating lambda for page: <B>${file}</B>
            </Box>
          </Box>
        `;
      }

      if (currentText.match(/Created lambda for page: \"(.*)\"/)) {
        const [_, file] = currentText.match(
          /Created lambda for page: \"(.*)\"/
        );
        return html`
          <Box display="flex">
            ${getBackgroundImageBox(
              ROOT_URL + '/lambda.svg',
              20,
              15,
              'inline-block'
            )}
            <Box display="inline-block">
              Created lambda for page: <B>${file}</B>
            </Box>
          </Box>
        `;
      }

      if (currentText.includes('No license field')) {
        return colorStartWord(
          currentText,
          'https://docs.npmjs.com/files/package.json#license'
        );
      }

      if (currentText.includes('No repository field')) {
        return colorStartWord(
          currentText,
          'https://docs.npmjs.com/files/package.json#repository'
        );
      }

      if (currentText.includes('No lockfile found')) {
        return colorStartWord(
          currentText,
          'https://yarnpkg.com/lang/en/docs/yarn-lock/'
        );
      }

      if (logText.toLowerCase().startsWith('info')) {
        return colorStartWord(currentText);
      }
      if (logText.startsWith('MODE:')) {
        return colorStartWord(currentText);
      }
      if (
        logText.toLowerCase().startsWith('warning') ||
        logText.startsWith('WARNING:')
      ) {
        return colorStartWord(currentText);
      }
      if (
        logText.trim().startsWith('success') ||
        logText.toLowerCase().startsWith('done')
      ) {
        return colorStartWord(currentText);
      }

      return html`
        <Box>${currentText}</Box>
      `;

      if (currentText.startsWith('entrypoint size limit:')) {
        return html`
          <Box display="flex">
            <Box marginRight="20px" color="#666">${date}</Box>
            <Box>
              ${currentText}
            </Box>
          </Box>
        `;
      }
    });
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

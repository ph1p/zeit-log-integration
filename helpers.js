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
  transformLogLine(text) {
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

      return htm`<Box padding="10px" marginBottom="10px" backgroundColor="#1f1f1f" borderRadius="5px">${structuredReport.map(
        rep => htm`<Box><B>${rep.key}:</B> ${rep.value}</Box>`
      )}</Box>`;
    }

    newText = newText.split('\n');
    return htm`<Box>${
      newText.length ? newText.map(te => htm`${te}<BR />`) : text
    }</Box>`;
  },
  isImage(file) {
    return;
    file.includes('.png') ||
      file.includes('.jpg') ||
      file.includes('.jpeg') ||
      file.includes('.gif');
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

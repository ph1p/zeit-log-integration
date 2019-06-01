const { withUiHook, htm } = require('@zeit/integration-utils');

const apiClient = zeitClient => ({
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
    return await zeitClient.fetchAndThrow(`/v5/now/deployments/${id}/builds`, {
      method: 'GET'
    });
  },
  async getDeploymentLogs(id) {
    return await zeitClient.fetchAndThrow(`/v2/now/deployments/${id}/events`, {
      method: 'GET'
    });
  }
});

let deployments = [];
let builds = [];
let buildLogs = [];
let outputLogs = [];
let otherLogs = [];
let deployment = null;

const transformLogLine = text => {
  if (text.includes('-')) {
  }
  let t = text.split('\n');

  return t.length
    ? t.map(te => htm`${te.replace(/\033\[[0-9;]*m/g, '')}<BR />`)
    : text;
};

const Log = ({ logs }) => {
  return logs.length
    ? htm`<Fieldset>
    <FsContent>
      <Box height="400px" overflow="auto">
        ${logs.map(log => {
          const { info, text } = log.payload;
          const { type, entrypoint, path, name } = info;

          return htm`<Box display="grid" gridTemplateColumns="200px 1fr">
            <Box>${type} ${entrypoint}</Box>
            <Box>${transformLogLine(text)}</Box>
          </Box>`;
        })}
      </Box>
    </FsContent>
  </Fieldset>`
    : '';
};

module.exports = withUiHook(async ({ payload, zeitClient }) => {
  const api = apiClient(zeitClient);

  if (payload.projectId) {
    deployments = (await api.getDeployments(payload.projectId)).deployments;
  }

  if (payload.action === 'change-deployment') {
    const { selectedDeployment } = payload.clientState;

    builds = (await api.getDeploymentBuilds(selectedDeployment)).builds || [];
    deployment = (await api.getDeploymentById(selectedDeployment)).builds || [];

    const logs = await api.getDeploymentLogs(selectedDeployment);
    buildLogs = logs.filter(
      l => l.type === 'stdout' && l.payload.info.type === 'build'
    );
    outputLogs = logs.filter(
      l => l.type === 'stdout' && l.payload.info.type === 'output'
    );
    otherLogs = logs.filter(
      l =>
        l.type === 'stdout' &&
        l.payload.info.type !== 'output' &&
        l.payload.info.type !== 'build'
    );
  }

  return htm`
    <Page>

      <Fieldset>
        <FsContent>
          <Box display="grid" gridTemplateColumns="1fr 1fr" alignItems="center">
            <ProjectSwitcher />
            <Select name="selectedDeployment" value="selectedDeployment" action="change-deployment">
              <Option value="" caption="Please select..." />
              ${deployments.map(
                deployment =>
                  htm`<Option value=${deployment.uid} caption=${
                    deployment.url
                  } />`
              )}
            </Select>
          </Box>
        </FsContent>
      </Fieldset>

${JSON.stringify(deployment)}

      <Box>
        ${builds.map(build => htm`<Box>${JSON.stringify(build)}</Box>`)}
      </Box>






      <${Log} logs=${buildLogs} />
      <${Log} logs=${outputLogs} />
      <${Log} logs=${otherLogs} />

		</Page>
	`;
});

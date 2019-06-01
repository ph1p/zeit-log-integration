const { withUiHook, htm } = require('@zeit/integration-utils');

const HOST = 'http://localhost:5005';

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

const transformLogLine = text => {
  if (text.includes('-')) {
  }
  let newText = text.replace(/\033\[[0-9;]*m/g, '');
  console.log(newText);

  if (newText.includes('REPORT RequestId:') === newText.length - 2) {
    return newText;
  }

  newText = newText.split('\n');
  return newText.length
    ? newText.map(te => htm`${te}<BR />`)
    : text;
};

const getIconByFile = (file, width = 40, height = 40) => {
  const ext = file.split('.');
  if (ext.length > 1) {
    return htm`<Box display="inline-block" backgroundImage=${'url(' +
      HOST +
      '/' +
      ext.pop() +
      '.svg)'} width=${width + 'px'} height=${height +
      'px'} backgroundSize="cover" />`;
  }
  return '';
};

const Log = ({ logs, name }) => {
  return logs.length
    ? htm`<Fieldset>
    <FsContent>
      ${getIconByFile(name)}
      <FsTitle>${name}</FsTitle>
      <Box height="400px" overflow="auto" lineHeight="20px" backgroundColor="#000" color="#fff" padding="20px" borderRadius="5px">
        ${logs.map(log => {
          const { info, text } = log.payload;
          const { type, entrypoint, path, name } = info;

          if (type === 'output') {
            return htm`<Box>${transformLogLine(text)}</Box>`;
          }

          return htm` <Box>${transformLogLine(text)}</Box>`;
        })}
      </Box>
    </FsContent>
  </Fieldset>`
    : '';
};

const getLocationList = out => {
  if (out.lambda && out.lambda.deployedTo) {
    return htm`<Box><B>Locations:</B> ${out.lambda.deployedTo.map(lo => {
      const name = lo.replace(/[0-9]/g, '');

      return htm`<Link target="_blank" href=${'https://' +
        name +
        '.zeit.co'}>${lo.toUpperCase()}</Link>`;
    })}</Box>`;
  }
  return '';
};

const allLogs = {
  output: [],
  others: []
};

module.exports = withUiHook(async ({ payload, zeitClient }) => {
  const api = apiClient(zeitClient);
  const metadata = await zeitClient.getMetadata();

  // vars
  let deployments = [];
  let builds = [];
  let buildLogs = [];
  let outputLogs = [];
  let otherLogs = [];
  let deployment = null;

  if (payload.projectId) {
    deployments = await api.getDeployments(payload.projectId);
  }

  if (payload.action === 'change-deployment') {
    const { selectedDeployment } = payload.clientState;

    metadata.selectedDeployment = selectedDeployment;
    await zeitClient.setMetadata(metadata);

    builds = (await api.getDeploymentBuilds(selectedDeployment)).builds || [];
    deployment = (await api.getDeploymentById(selectedDeployment)) || [];

    const logs = await api.getDeploymentLogs(selectedDeployment);

    logs.forEach(l => {
      if (l.payload.info.entrypoint && !allLogs[l.payload.info.entrypoint]) {
        allLogs[l.payload.info.entrypoint] = [];
      }

      if (l.payload.info.type === 'output') {
        allLogs['output'].push(l);
      } else if (typeof l.payload.info.entrypoint === 'undefined') {
        allLogs['others'].push(l);
      } else {
        allLogs[l.payload.info.entrypoint].push(l);
      }
    });

    console.log(Object.keys(allLogs));

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

            ${
              deployments.deployments
                ? htm`
                  <Select name="selectedDeployment" value="selectedDeployment" action="change-deployment">
                    <Option value="" caption="Select deployment..." />
                    ${deployments.deployments.map(deployment => {
                      let name = deployment.url;

                      if (deployment.state === 'ERROR') {
                        name = 'Error -> ' + name;
                      }

                      return htm`<Option value=${
                        deployment.uid
                      } caption=${name} />`;
                    })}
                  </Select>`
                : ''
            }
          </Box>
        </FsContent>
      </Fieldset>

      ${
        deployment
          ? htm`
          <H2>${deployment.name}</H2>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gridGap="20px">

            <Box>
              <Fieldset>
                <FsContent>
                  <UL>
                    ${deployment.build.env.map(e => htm`<LI>${e}</LI>`)}
                  </UL>
                </FsContent>
              </Fieldset>
            </Box>

            <Box height="400px" overflow="auto">
              <Fieldset>
                <FsContent>
                  <FsTitle>Builds</FsTitle>
                  ${builds.map(
                    build => htm`<Box display="grid" gridGap="10px">
                    ID: ${build.id}
                    ${build.output.map(
                      out => htm`<Box backgroundColor="#f3f3f3" borderRadius="5px" display="grid" gridTemplateColumns="20px 1fr 70px" position="relative" padding="10px" fontSize="12px">
                        <Box>${getIconByFile(out.path, 17, 15)}</Box>
                        <Box>${out.path}</Box>
                        <Box textAlign="right" color="#999">${(
                          out.size /
                          1024 /
                          1024
                        ).toFixed(2)} MB</Box>
                        ${getLocationList(out)}
                      </Box>`
                    )}</Box>`
                  )}
                </FsContent>
              </Fieldset>
            </Box>
          </Box>

          <Box display="grid" gridTemplateColumns="1fr" gridGap="20px" marginTop="20px">
            ${Object.keys(allLogs).map(
              l => htm`<Box><${Log} name=${l} logs=${allLogs[l]} /></Box>`
            )}
          </Bo>


      `
          : ''
      }

		</Page>
	`;
});

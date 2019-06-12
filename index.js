const { withUiHook, htm: html } = require('@zeit/integration-utils');
const {
  apiClient,
  transformLogLine,
  getIconByFile,
  compressLogs
} = require('./helpers');

const Builds = require('./components/builds');

const { ROOT_URL } = process.env;

const notes = {
  codeSplitting: {
    message: 'Reduce JavaScript Payloads with Code Splitting',
    link:
      'https://developers.google.com/web/fundamentals/performance/optimizing-javascript/code-splitting/'
  },
  compressImage: {
    message: 'Think about reducing the image size',
    link: 'https://squoosh.app/'
  }
};

const Log = ({ logs, name }) => {
  return logs
    ? Object.keys(logs).map(logName => {
        let prefix = '';

        if (logName === 'output') {
          prefix = 'Output: ';
        } else if (logName === 'logs') {
          prefix = 'Entrypoint: ';
        }

        const compressedLogs = compressLogs(logs[logName]);
        const countLogs = compressedLogs ? Object.keys(compressedLogs).length : 0;

        return countLogs > 0
          ? html`
              <Fieldset>
                <FsContent>
                  <Box display="flex" marginBottom="10px">
                    <Box marginRight="5px">
                      ${getIconByFile(name)}
                    </Box>
                    <Box alignSelf="center">
                      <FsTitle>${prefix + name}</FsTitle>
                    </Box>
                  </Box>
                  <Box
                    fontFamily="Menlo, Monaco, 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', monospace, serif"
                    maxHeight="400px"
                    overflow="auto"
                    whiteSpace="nowrap"
                    maxWidth="958px"
                    lineHeight="20px"
                    backgroundColor="#000"
                    color="#fff"
                    padding="20px 20px 0 20px"
                    borderRadius="5px"
                  >
                    ${Object.keys(compressedLogs).map((date, index) => {
                      return html`
                        <Box
                          display="grid"
                          gridTemplateColumns="200px 1fr"
                          gridGap="20px"
                          borderBottom=${index === countLogs - 1
                            ? 0
                            : '1px solid rgba(255, 255, 255, 0.2)'}
                          padding=${index === 0 ? '0 0 20px' : '20px 0'}
                        >
                          <Box color="#666" fontWeight="bold">
                            ${date}
                          </Box>
                          <Box>
                            ${compressedLogs[date].map(log =>
                              transformLogLine(log.payload.text)
                            )}
                          </Box>
                        </Box>
                      `;
                    })}
                  </Box>
                </FsContent>
              </Fieldset>
            `
          : '';
      })
    : '';
};

module.exports = withUiHook(async ({ payload, zeitClient }) => {
  const api = apiClient(zeitClient);
  const metadata = await zeitClient.getMetadata();

  // vars
  let deployment = null;
  let deployments = [];
  let builds = [];
  let buildLogs = [];
  let outputLogs = [];
  let otherLogs = [];
  const allLogs = {
    output: {
      logs: []
    },
    others: {
      logs: []
    }
  };

  const getDeploymentData = async id => {
    try {
      builds = (await api.getDeploymentBuilds(id)).builds || [];
      deployment = (await api.getDeploymentById(id)) || [];

      const logs = await api.getDeploymentLogs(metadata.selectedDeployment);

      logs.forEach(l => {
        const { path, entrypoint } = l.payload.info;

        let name = path || entrypoint;
        if (name.split('.').length <= 1) {
          name = name + '.lambda';
        }

        if (name && !allLogs[name]) {
          allLogs[name] = {
            logs: [],
            output: []
          };
        }

        if (l.payload.info.type === 'output') {
          if (name) {
            allLogs[name].output.push(l);
          } else {
            allLogs['output'].logs.push(l);
          }
        } else if (typeof entrypoint === 'undefined') {
          allLogs['others'].logs.push(l);
        } else {
          allLogs[entrypoint].logs.push(l);
        }
      });

      if (logs) {
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
    } catch (e) {
      deployment = null;
      deployments = [];
      builds = [];
      buildLogs = [];
      outputLogs = [];
      otherLogs = [];
    }
  };

  if (payload.projectId) {
    deployments = await api.getDeployments(payload.projectId);

    if (
      !deployments.deployments.some(d => d.uid === metadata.selectedDeployment)
    ) {
      metadata.selectedDeployment = deployments.deployments[0].uid;
      await zeitClient.setMetadata(metadata);
      await getDeploymentData(metadata.selectedDeployment);
    }
  }

  if (payload.action === 'change-deployment') {
    const { selectedDeployment } = payload.clientState;

    metadata.selectedDeployment = selectedDeployment;
    await zeitClient.setMetadata(metadata);

    await getDeploymentData(metadata.selectedDeployment);
  }

  if (payload.projectId && metadata.selectedDeployment) {
    await getDeploymentData(metadata.selectedDeployment);
  } else {
    delete metadata.selectedDeployment;
    await zeitClient.setMetadata(metadata);
  }

  if (payload.action === 'refresh') {
    if (!payload.projectId) {
      await getDeploymentData(metadata.selectedDeployment);
    }
  }

  return html`
    <Page>
      ${deployment && deployments
        ? html`
        <Fieldset>
          <FsContent>
            <Box display="grid" gridTemplateColumns="1fr 250px" alignItems="center">
              <ProjectSwitcher />

              <Select small name="selectedDeployment" value=${
                metadata.selectedDeployment
              } action="change-deployment">
                ${deployments.deployments.map(deployment => {
                  let name = deployment.url;

                  if (deployment.state === 'ERROR') {
                    name = 'Error -> ' + name;
                  }

                  return html`
                    <Option
                      selected=${deployment.uid === metadata.selectedDeployment}
                      value=${deployment.uid}
                      caption=${name}
                    />
                  `;
                })}
              </Select>
            </Box>
          </FsContent>
        </Fieldset>


          <Box display="flex" justifyContent="space-between" marginBottom="20px">
            <Box>
              <H2>${deployment.name} <Link target="_blank" href=${'https://' +
            deployment.url}>${`(${deployment.url})`}</Link></H2>
            </Box>
            <Box>
              <Button small action="refresh">Refresh</Button>
            </Box>
          </Box>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gridGap="20px">
            <Box>
              <Fieldset>
                <FsContent>

                  ${
                    deployment.routes &&
                    deployment.routes.filter(r => r.src && r.dest).length
                      ? html`
                          <Box marginBottom="10px">
                            <FsTitle>Routes</FsTitle>
                            ${deployment.routes.map(route =>
                              route.src && route.dest
                                ? html`
                                    <Box
                                      display="grid"
                                      marginBottom="10px"
                                      gridTemplateColumns="40px 1fr 40px 1fr"
                                      lineHeight="18px"
                                      backgroundColor="#f3f3f3"
                                      borderRadius="5px"
                                      padding="10px"
                                      fontSize="12px"
                                    >
                                      <Box>from</Box>
                                      <Box><B>${route.src}</B></Box>
                                      <Box textAlign="center">to</Box>
                                      <Box textAlign="right">
                                        <B>${route.dest}</B>
                                      </Box>
                                    </Box>
                                  `
                                : ''
                            )}
                          </Box>
                        `
                      : ''
                  }

                  ${
                    deployment.build &&
                    deployment.build.env &&
                    deployment.build.env.filter(e => !e.startsWith('NOW_'))
                      .length
                      ? html`
                          <Box marginBottom="10px">
                            <FsTitle>Environment Variables (build)</FsTitle>
                            ${deployment.build.env
                              .filter(e => !e.startsWith('NOW_'))
                              .map(
                                e =>
                                  html`
                                    <Box>- ${e}</Box>
                                  `
                              )}
                          </Box>
                        `
                      : ''
                  }

                  ${
                    deployment.env &&
                    deployment.env.filter(e => !e.startsWith('NOW_')).length
                      ? html`
                          <Box marginBottom="10px">
                            <FsTitle>Environment Variables</FsTitle>
                            ${deployment.env
                              .filter(e => !e.startsWith('NOW_'))
                              .map(
                                e =>
                                  html`
                                    <Box>- ${e}</Box>
                                  `
                              )}
                          </Box>
                        `
                      : ''
                  }

                  ${
                    deployment.alias.length > 0
                      ? html`
                          <Box>
                            <FsTitle>Alias</FsTitle>
                            ${deployment.alias.map(
                              e =>
                                html`<Box>- <Link target="_blank" href=${'https://' +
                                  e}>${e}</Link></Box>`
                            )}
                          </Box>
                        `
                      : ''
                  }
                </FsContent>
              </Fieldset>
            </Box>

            <${Builds} builds=${builds} notes=${notes} deployment=${deployment} />
          </Box>

          ${Object.keys(allLogs).map(
            name => html`
              <${Log} name=${name} logs=${allLogs[name]} />
            `
          )}`
        : html`
            <Box
              display="grid"
              alignItems="center"
              minHeight="900px"
              justifyItems="center"
            >
              <Box alignSelf="end">
                <B>Please</B>
                <ProjectSwitcher />
              </Box>
              <Box>
                <Img src=${ROOT_URL + '/assets/illu.png'} />
              </Box>
            </Box>
          `}
    </Page>
  `;
});

const { withUiHook, htm } = require('@zeit/integration-utils');
const prettyBytes = require('pretty-bytes');
const { parse, format } = require('date-fns');
const {
  apiClient,
  transformLogLine,
  isImage,
  getBackgroundImageBox,
  getIconByFile
} = require('./helpers');

const HOST = 'http://localhost:5005';

const notes = {
  codeSplitting: {
    message: 'Reduce JavaScript Payloads with Code Splitting',
    link:
      'https://developers.google.com/web/fundamentals/performance/optimizing-javascript/code-splitting/'
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

        return logs[logName] && logs[logName].length
          ? htm`<Fieldset>
          <FsContent>
            <Box display="flex" marginBottom="10px">
              <Box marginRight="5px">
                ${getIconByFile(name)}
              </Box>
              <Box alignSelf="center">
                <FsTitle>${prefix + name}</FsTitle>
              </Box>
            </Box>
            <Box fontFamily="Menlo, Monaco, 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', monospace, serif" maxHeight="400px" overflow="auto" whiteSpace="nowrap" maxWidth="958px" lineHeight="20px" backgroundColor="#000" color="#fff" padding="20px" borderRadius="5px">
              ${logs[logName].map(log => {
                const { info, text, date } = log.payload;
                const { type, entrypoint, path, name } = info;

                return transformLogLine(
                  text,
                  format(parse(date), 'MM.DD.YYYY - H:mm:ss')
                );
              })}
            </Box>
          </FsContent>
        </Fieldset>`
          : '';
      })
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
    } catch (e) {
      console.log(e);
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

  return htm`
    <Page>
      <Fieldset>
        <FsContent>
          <Box display="grid" gridTemplateColumns="1fr 250px" alignItems="center">
            <ProjectSwitcher/>
            ${
              deployments.deployments
                ? htm`
                  <Select small name="selectedDeployment" value=${
                    metadata.selectedDeployment
                  } action="change-deployment">
                    ${deployments.deployments.map(deployment => {
                      let name = deployment.url;

                      if (deployment.state === 'ERROR') {
                        name = 'Error -> ' + name;
                      }

                      return htm`<Option selected=${deployment.uid ===
                        metadata.selectedDeployment} value=${
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
        deployment && deployments
          ? htm`
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
                    deployment.build.env.filter(e => !e.startsWith('NOW_'))
                      .length
                      ? htm`<Box marginBottom="10px">
                    <Box fontSize="14px" fontWeight="500" marginBottom="5px">Environment Variables (build)</Box>
                    ${deployment.build.env
                      .filter(e => !e.startsWith('NOW_'))
                      .map(e => htm`<Box>- ${e}</Box>`)}
                  </Box>`
                      : ''
                  }

                  ${
                    deployment.env.filter(e => !e.startsWith('NOW_')).length
                      ? htm`<Box marginBottom="10px">
                    <Box fontSize="14px" fontWeight="500" marginBottom="5px">Environment Variables</Box>
                    ${deployment.env
                      .filter(e => !e.startsWith('NOW_'))
                      .map(e => htm`<Box>- ${e}</Box>`)}
                  </Box>`
                      : ''
                  }

                  ${
                    deployment.alias.length > 0
                      ? htm`<Box>
                    <Box fontSize="14px" fontWeight="500" marginBottom="5px">Alias</Box>
                    ${deployment.alias.map(
                      e =>
                        htm`<Box>- <Link target="_blank" href=${'https://' +
                          e}>${e}</Link></Box>`
                    )}
                  </Box>`
                      : ''
                  }
                </FsContent>
              </Fieldset>
            </Box>

            <Box maxHeight="400px" overflow="auto">
              <Fieldset>
                <FsContent>
                  <FsTitle>Builds</FsTitle>
                  <Box display="grid" gridGap="10px">
                    ${builds.map(
                      build => htm`<Box display="grid" gridGap="10px">
                      <Box>
                        <B>ID:</B> ${build.id}
                      </Box>
                      ${build.output.map(out => {
                        const icon = getIconByFile(
                          out.type === 'lambda' ? '.lambda' : out.path,
                          17,
                          15
                        );
                        const url =
                          'https://' + deployment.url + '/' + out.path;
                        const fileSize = prettyBytes(out.size);
                        const fileName = out.path.replace(/^.*[\\\/]/, '');
                        const path = out.path.replace(fileName, '');
                        let note = null;

                        if (out.size >= 1300000 && fileName.includes('.js')) {
                          note = notes.codeSplitting;
                        }

                        return htm`<Box backgroundColor="#f3f3f3" borderRadius="5px" display="grid" gridTemplateColumns="24px 1fr 70px" position="relative" padding="10px" fontSize="12px">
                            <Box alignSelf="center">${icon}</Box>
                          <Box>
                          <Link target="_blank" href=${url}>${fileName}</Link>
                          <Box color="#999" lineHeight="11px" fontSize="11px">${path}</Box>
                          </Box>
                          <Box textAlign="right" color="#999">${
                            out.size ? fileSize : ''
                          }</Box>
                          ${getLocationList(out)}

                          ${
                            note
                              ? htm`<Box gridColumn="1/ span 3" marginTop="15px" fontWeight="bold"><Link href=${note.link} target="_blank">${
                                  note.message
                                }</Link></Box>`
                              : ''
                          }

                          ${
                            isImage(out.path)
                              ? htm`<Box marginTop="12px">${getBackgroundImageBox(
                                  'https://' + deployment.url + '/' + out.path,
                                  50,
                                  50
                                )}</Box>`
                              : ''
                          }
                          </Box>`;
                      })}</Box>`
                    )}
                  </Box>
                </FsContent>
              </Fieldset>
            </Box>
          </Box>


          ${Object.keys(allLogs).map(
            name => htm`
            <${Log} name=${name} logs=${allLogs[name]} />`
          )}`
          : ''
      }

		</Page>
	`;
});

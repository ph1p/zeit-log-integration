const { withUiHook, htm } = require('@zeit/integration-utils');
const { apiClient, transformLogLine, isImage, getBackgroundImageBox, getIconByFile } = require('./helpers');

const HOST = 'http://localhost:5005';


const Log = ({ logs, name }) => {
  return logs.length
    ? htm`<Fieldset>
    <FsContent>
      ${getIconByFile(name)}
      <FsTitle>${
        name !== 'output' && name !== 'others' ? 'Entrypoint: ' + name : name
      }</FsTitle>
      <Box maxHeight="400px" overflow="auto" whiteSpace="nowrap" maxWidth="958px" lineHeight="20px" backgroundColor="#000" color="#fff" padding="20px" borderRadius="5px">
        ${logs.map(log => {
          const { info, text } = log.payload;
          const { type, entrypoint, path, name } = info;

          if (type === 'output') {
            return transformLogLine(text);
          }

          return transformLogLine(text);
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

  const getDeploymentData = async id => {
    builds = (await api.getDeploymentBuilds(id)).builds || [];
    deployment = (await api.getDeploymentById(id)) || [];

    const logs = await api.getDeploymentLogs(metadata.selectedDeployment);

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
  };

  if (payload.action === 'change-deployment') {
    const { selectedDeployment } = payload.clientState;

    metadata.selectedDeployment = selectedDeployment;
    await zeitClient.setMetadata(metadata);

    await getDeploymentData(metadata.selectedDeployment);
  }

  if (metadata.selectedDeployment && payload.projectId) {
    await getDeploymentData(metadata.selectedDeployment);
  }

  if (payload.action === 'refresh') {
    if (metadata.selectedDeployment && payload.projectId) {
      await getDeploymentData(metadata.selectedDeployment);
    }
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
                  <Select small name="selectedDeployment" value="selectedDeployment" action="change-deployment">
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
                  <UL>
                    ${deployment.build.env
                      .filter(e => !e.startsWith('NOW_'))
                      .map(e => htm`<LI>${e}</LI>`)}
                    ${deployment.env
                      .filter(e => !e.startsWith('NOW_'))
                      .map(e => htm`<LI>${e}</LI>`)}
                  </UL>

                  <UL>
                    ${deployment.alias.map(e => htm`<LI>${e}</LI>`)}
                  </UL>
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
                      ID: ${build.id}
                      ${build.output.map(
                        out => htm`<Box backgroundColor="#f3f3f3" borderRadius="5px" display="grid" gridTemplateColumns="24px 1fr 70px" position="relative" padding="10px" fontSize="12px">
                            <Box alignSelf="center">${getIconByFile(
                              out.type === 'lambda' ? '.lambda' : out.path,
                              17,
                              15
                            )}</Box>
                          <Box>
                          <Link target="_blank" href=${'https://' +
                            deployment.url +
                            '/' +
                            out.path}>${out.path}
                            </Link>
                          </Box>
                          <Box textAlign="right" color="#999">${(
                            out.size /
                            1024 /
                            1024
                          ).toFixed(2)} MB</Box>
                          ${getLocationList(out)}

                          ${
                            isImage(out.path)
                              ? htm`<Box marginTop="10px">${getBackgroundImageBox(
                                  'https://' + deployment.url + '/' + out.path,
                                  50,
                                  50
                                )}</Box>`
                              : ''
                          }
                          </Box>`
                      )}</Box>`
                    )}
                  </Box>
                </FsContent>
              </Fieldset>
            </Box>
          </Box>

            ${Object.keys(allLogs).map(
              l => htm`<${Log} name=${l} logs=${allLogs[l]} />`
            )}



      `
          : ''
      }

		</Page>
	`;
});

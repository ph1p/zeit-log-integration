const { htm: html } = require('@zeit/integration-utils');
const prettyBytes = require('pretty-bytes');
const { getIconByFile, isImage, getBackgroundImageBox } = require('../helpers');

const usedPackage = use => {
  if (!use) return '';

  if (!use.includes('@now')) {
    return html`
      uses <B>${use}</B>
    `;
  }

  const url =
    'https://github.com/zeit/now-builders/tree/canary/packages/' +
    use.replace('@', '').replace('/', '-');

  return html`uses <Link href=${url} target="_blank"><B>${use}</B></Link>`;
};

const stateColors = {
  INITIALIZING: '#EAEAEA',
  ANALYZING: '#0076FF',
  BUILDING: '#D9931E',
  DEPLOYING: '#F5A623',
  READY: '#2CBE4E',
  ERROR: '#FF0000'
};

const getLocationList = out => {
  if (out.lambda && out.lambda.deployedTo) {
    return html`
      <Box
        ><B>Locations:</B> ${out.lambda.deployedTo.map(lo => {
          const name = lo.replace(/[0-9]/g, '');

          return html`<Link target="_blank" href=${'https://' +
            name +
            '.zeit.co'}>${lo.toUpperCase()}</Link>`;
        })}</Box
      >
    `;
  }
  return '';
};

module.exports = ({ builds, notes, deployment }) => {
  return html`
    <Box maxHeight="400px" overflow="auto">
      <Fieldset>
        <FsContent>
          <FsTitle>Builds</FsTitle>
          <Box display="grid" gridGap="10px">
            ${builds.map(
              build => html`
                <Box display="grid" gridGap="10px">
                  <Box display="flex" justifyContent="space-between">
                    <Box>
                      <B>ID:</B> ${build.id}
                      <Box color="#999" lineHeight="11px" fontSize="11px"
                        >${build.entrypoint}${usedPackage(build.use)}</Box
                      >
                    </Box>
                    <Box alignSelf="center">
                      <Box
                        color="#999"
                        lineHeight="11px"
                        fontSize="11px"
                        color="#fff"
                        fontWeight="bold"
                        borderRadius="5px"
                        padding="10px 15px"
                        backgroundColor=${stateColors[build.readyState]}
                      >
                        ${build.readyState}
                      </Box>
                    </Box>
                  </Box>
                  ${build.output.map(out => {
                    const icon = getIconByFile(
                      out.type === 'lambda' ? '.lambda' : out.path,
                      17,
                      15
                    );
                    const url = 'https://' + deployment.url + '/' + out.path;
                    const fileSize = prettyBytes(out.size);
                    const fileName = out.path.replace(/^.*[\\\/]/, '');
                    const path = out.path.replace(fileName, '');
                    let note = null;

                    if (out.size >= 1300000 && fileName.includes('.js')) {
                      note = notes.codeSplitting;
                    }

                    return html`<Box
                        backgroundColor="#f3f3f3"
                        borderRadius="5px"
                        display="grid"
                        gridTemplateColumns="24px 1fr 70px"
                        position="relative"
                        padding="10px"
                        fontSize="12px"
                      >
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
                        ? html`<Box gridColumn="1/ span 3" marginTop="15px" fontWeight="bold">
                          <Link href=${note.link} target="_blank">
                            ${note.message}
                          </Link>
                        </Box>`
                        : ''
                    }

                    ${
                      isImage(out.path)
                        ? html`
                            <Box marginTop="12px"
                              >${getBackgroundImageBox(
                                'https://' + deployment.url + '/' + out.path,
                                50,
                                50
                              )}</Box
                            >
                          `
                        : ''
                    }
                    </Box>`;
                  })}</Box
                >
              `
            )}
          </Box>
        </FsContent>
      </Fieldset>
    </Box>
  `;
};

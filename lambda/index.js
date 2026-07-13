/* eslint-disable no-console */
const Alexa = require('ask-sdk-core');
const https = require('https');

const API_HOST = 'caquinho-bot.marcosvasconcelos.dev.br';
const API_PATH = '/api/alexa/glucose';

/**
 * Consulta o endpoint /api/alexa/glucose do caquinho-bot e retorna a leitura atual.
 * Usa o módulo https nativo (sem dependências externas).
 */
function getGlucoseData() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      path: API_PATH,
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.ALEXA_API_KEY || '',
      },
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Resposta inesperada do caquinho-bot: ${res.statusCode} ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy(new Error('Tempo limite ao consultar o caquinho-bot'));
    });

    req.end();
  });
}

function buildGlucoseSpeech(data) {
  const { sgv, direction_text: directionText, minutes_ago: minutesAgo } = data;

  const tempoFala = minutesAgo <= 1 ? 'agora mesmo' : `há ${minutesAgo} minutos`;

  return `${tempoFala}, ${sgv} miligramas por decilitro. Tendência: ${directionText}.`;
}

async function sendProgressiveResponse(handlerInput, speech) {
  try {
    const directiveServiceClient = handlerInput.serviceClientFactory.getDirectiveServiceClient();
    await directiveServiceClient.enqueue({
      header: { requestId: handlerInput.requestEnvelope.request.requestId },
      directive: { type: 'VoicePlayer.Speak', speech },
    });
  } catch (err) {
    console.error('Erro ao enviar resposta progressiva:', err);
  }
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  async handle(handlerInput) {
    await sendProgressiveResponse(handlerInput, 'Consultando.');
    try {
      const data = await getGlucoseData();
      return handlerInput.responseBuilder
        .speak(buildGlucoseSpeech(data))
        .withShouldEndSession(true)
        .getResponse();
    } catch (err) {
      console.error('Erro ao consultar glicose:', err);
      return handlerInput.responseBuilder
        .speak('Não consegui consultar a glicose agora. Tente novamente em alguns instantes.')
        .withShouldEndSession(true)
        .getResponse();
    }
  },
};

const GlicoseAgoraIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GlicoseAgoraIntent'
    );
  },
  async handle(handlerInput) {
    await sendProgressiveResponse(handlerInput, 'Consultando.');
    try {
      const data = await getGlucoseData();
      return handlerInput.responseBuilder
        .speak(buildGlucoseSpeech(data))
        .withShouldEndSession(true)
        .getResponse();
    } catch (err) {
      console.error('Erro ao consultar glicose:', err);
      return handlerInput.responseBuilder
        .speak('Não consegui consultar a glicose agora. Tente novamente em alguns instantes.')
        .withShouldEndSession(true)
        .getResponse();
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent'
    );
  },
  handle(handlerInput) {
    const speakOutput = 'Diga "glicose agora" para saber a última leitura registrada no Nightscout.';
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
        || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent')
    );
  },
  handle(handlerInput) {
    const speakOutput = 'Até logo!';
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  },
};

const IntentReflectorHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
  },
  handle(handlerInput) {
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    const speakOutput = `Você acabou de ativar ${intentName}.`;
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('Erro tratado pelo ErrorHandler:', error);
    const speakOutput = 'Desculpe, houve um problema ao processar seu pedido. Tente novamente.';
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    GlicoseAgoraIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
    IntentReflectorHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();

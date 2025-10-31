import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables.
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// DADOS DE TESTE - Hardcoded
const DADOS_CLIENTE_TESTE = {
    nome: 'Paulo Godoy',
    valor: '1.500,00',
    empresa: 'Poderoso Timão',
    data: '15/11/2024',
    contrato: 'CTR-2024-001'
};

// Constants
const SYSTEM_MESSAGE = `Você é Lucas, um agente de cobrança profissional da empresa Ólos Tecnologia.

=== IDENTIDADE E TOM ===
- Nome: Lucas
- Empresa: Ólos Tecnologia
- Tom: Profissional, educado, firme mas respeitoso
- Objetivo: Resolver a situação da dívida de forma amigável
- Idioma: Português brasileiro natural e claro

=== INFORMAÇÕES DO CLIENTE (IMPORTANTE - USE EXATAMENTE ESSES DADOS) ===
- Nome do Cliente: ${DADOS_CLIENTE_TESTE.nome}
- Valor da Dívida: R$ ${DADOS_CLIENTE_TESTE.valor}
- Empresa Credora: ${DADOS_CLIENTE_TESTE.empresa}
- Data de Vencimento: ${DADOS_CLIENTE_TESTE.data}
- Número do Contrato: ${DADOS_CLIENTE_TESTE.contrato}

=== INFORMAÇÕES QUE VOCÊ CONHECE ===
(Estas informações serão fornecidas no início da ligação)
- Nome completo do devedor
- Valor da dívida
- Data de vencimento original
- Empresa credora
- Número do contrato/boleto

=== SCRIPT DE COBRANÇA (SIGA ESTA ORDEM) ===

1. ABERTURA (Identificação)
   "Bom dia/Boa tarde, meu nome é Lucas da Olos Cobranças. Estou falando com ${DADOS_CLIENTE_TESTE.nome}?"
   
   Aguarde confirmação.
   Caso o usuario não seja o cliente mas o conheça, peça para ligar mais tarde. 
   Caso o usuario não seja o cliente e nem o conheça, peça desculpas pelo transtorno.
   
   "Perfeito. ${DADOS_CLIENTE_TESTE.nome}, estou ligando em nome de ${DADOS_CLIENTE_TESTE.empresa} sobre o débito no valor de R$ ${DADOS_CLIENTE_TESTE.valor} com vencimento em ${DADOS_CLIENTE_TESTE.data}, contrato número ${DADOS_CLIENTE_TESTE.contrato}. Você tem conhecimento deste débito?"

2. CONFIRMAÇÃO E ESCUTA
   - Se SIM: Prossiga para negociação
   - Se NÃO: Explique detalhes (empresa, valor, data, número do contrato)
   - IMPORTANTE: Ouça a situação do cliente com empatia

3. INVESTIGAÇÃO DA SITUAÇÃO
   "Entendo. Poderia me explicar o que aconteceu para não ter sido possível realizar o pagamento?"
   
   Ouça atentamente e demonstre empatia:
   - "Entendo sua situação"
   - "Compreendo que esse momento é difícil"
   - "Vamos encontrar uma solução juntos"

4. APRESENTAR OPÇÕES (NA ORDEM)

   OPÇÃO A - Pagamento Integral:
    "Você conseguiria realizar o pagamento integral de R$ ${DADOS_CLIENTE_TESTE.valor} até amanhã?"
   
   OPÇÃO B - Parcelamento:
   "Caso não seja possível o pagamento integral, posso oferecer um parcelamento. Você preferiria pagar em quantas vezes? Temos opções de 2x, 3x ou até 6x."
   
   OPÇÃO C - Entrada + Parcelamento:
   "Outra opção é fazer uma entrada de R$ [VALOR_ENTRADA] hoje e parcelar o restante em [X] vezes de R$ [VALOR_PARCELA]. Isso ficaria bom para você?"
   
   OPÇÃO D - Data Futura:
   "Se nenhuma dessas opções for viável agora, em qual data você conseguiria fazer o pagamento? Posso agendar para uma data específica."

5. FECHAR ACORDO
   Quando o cliente aceitar uma opção:
   
   "Perfeito! Vou confirmar então: você vai realizar o pagamento de R$ [VALOR] até [DATA] / em [X] parcelas de R$ [VALOR]. Está correto?"
   
   "Ótimo! Vou enviar os dados para pagamento via [WhatsApp/Email/SMS]. Qual o melhor contato?"
   
   "Confirmo então seu [WhatsApp/Email]: [CONTATO]. Os dados chegarão em até 5 minutos."

6. ENCERRAMENTO
   "Agradeço sua atenção, [NOME]. Caso tenha qualquer dúvida, pode entrar em contato conosco. Tenha um ótimo dia!"

=== REGRAS OBRIGATÓRIAS ===

✅ SEMPRE FAZER:
- Ser educado e respeitoso, independente da reação do cliente
- Confirmar informações importantes (valores, datas)
- Oferecer opções de pagamento
- Anotar compromissos assumidos
- Agradecer ao final

❌ NUNCA FAZER:
- Ser agressivo, ameaçador ou desrespeitoso
- Ligar antes das 8h ou depois das 20h (mesmo que o cliente ligue)
- Fazer ameaças de protesto, SPC, ou processos judiciais
- Expor a situação para terceiros
- Insistir excessivamente se o cliente pedir para não ligar mais
- Gravar ou mencionar que está gravando sem autorização
- Usar palavras como "inadimplente", "caloteiro", "devedor"

=== OBJEÇÕES COMUNS E RESPOSTAS ===

Cliente: "Não tenho dinheiro agora"
Você: "Entendo perfeitamente. Por isso mesmo estou oferecendo opções flexíveis. Qual valor você conseguiria pagar como entrada? Podemos começar com um valor menor."

Cliente: "Vou pagar depois"
Você: "Ótimo! Para formalizar isso, qual data específica você consegue se comprometer? Assim eu já agendo aqui e não preciso incomodá-lo novamente."

Cliente: "Já paguei"
Você: "Perfeito! Você teria o comprovante? Posso aguardar enquanto você busca para confirmarmos aqui no sistema."

Cliente: "Essa dívida não é minha"
Você: "Entendo sua preocupação. Vou anotar sua contestação. Poderia me confirmar seus dados para verificarmos? [Nome completo, CPF, endereço]"

Cliente: "Não posso falar agora"
Você: "Sem problemas! Qual horário seria melhor para retornar a ligação? Manhã ou tarde?"

Cliente: "Parem de me ligar"
Você: "Entendo. Para que eu possa registrar aqui, você está se negando a negociar o débito? Neste caso, vou anotar e a cobrança seguirá por outros canais. Posso confirmar?"

=== INFORMAÇÕES DE COMPLIANCE ===

Você está ciente que:
- Esta ligação pode estar sendo gravada para fins de qualidade
- Você deve respeitar o Código de Defesa do Consumidor
- Você não pode fazer cobranças vexatórias
- Você deve ser transparente sobre a dívida

=== FORMATO DE RESPOSTA ===

- Fale de forma NATURAL e CONVERSACIONAL
- Use frases CURTAS (máximo 2-3 linhas por vez)
- AGUARDE resposta do cliente antes de continuar
- NÃO fale rápido demais
- REPITA informações importantes se necessário
- Se o cliente interromper, PARE e escute

=== FINALIZAÇÃO ===

Quando o acordo for fechado, use a seguinte função para registrar:
- Valor acordado
- Forma de pagamento
- Data do pagamento
- Contato do cliente

Mantenha sempre o profissionalismo e lembre-se: seu objetivo é RESOLVER, não apenas cobrar.`;
const VOICE = 'ballad';
const TEMPERATURE = 0.6; // Controls the randomness of the AI's responses
const PORT = process.env.PORT || 5050; // Allow dynamic port assignment

// List of Event Types to log to the console. See the OpenAI Realtime API Documentation: https://platform.openai.com/docs/api-reference/realtime
const LOG_EVENT_TYPES = [
    'error',
    'response.content.done',
    'rate_limits.updated',
    'response.done',
    'input_audio_buffer.committed',
    'input_audio_buffer.speech_stopped',
    'input_audio_buffer.speech_started',
    'session.created',
    'session.updated'
];

// Show AI response elapsed timing calculations
const SHOW_TIMING_MATH = false;

import fs from 'fs';
import path from 'path';

// Função para salvar tabulação
function salvarTabulacao(dados) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `tabulacao_${timestamp}.json`;
    const filepath = path.join('/tmp', filename);
    
    try {
        fs.writeFileSync(filepath, JSON.stringify(dados, null, 2));
        console.log('✅ Tabulação salva:', filename);
        return filepath;
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        return null;
    }
}

// Root Route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// Route for Twilio to handle incoming calls
// <Say> punctuation to improve text-to-speech translation
fastify.all('/incoming-call', async (request, reply) => {
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say voice="Polly.Camila" language="pt-BR">Olá! Aguarde enquanto conectamos você com nosso assistente virtual da Olos.</Say>
                              <Pause length="1"/>
                              <Say voice="Polly.Camila" language="pt-BR">Pode falar!</Say>
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;

    reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('Client connected');
        
// ========================================
        // 📊 DADOS PARA TABULAÇÃO
        // ========================================
        let dadosChamada = {
            inicio: new Date().toISOString(),
            fim: null,
            duracao_segundos: 0,
            cliente: {
                nome: DADOS_CLIENTE_TESTE.nome,
                valor_divida: DADOS_CLIENTE_TESTE.valor,
                empresa: DADOS_CLIENTE_TESTE.empresa,
                data_vencimento: DADOS_CLIENTE_TESTE.data,
                contrato: DADOS_CLIENTE_TESTE.contrato
            },
            resultado: 'em_andamento',
            acordo: null,
            observacoes: '',
            transcricao: []
        };
        
        let callSid = null;
        
        // Connection-specific state
        let streamSid = null;
        let latestMediaTimestamp = 0;
        let lastAssistantItem = null;
        let markQueue = [];
        let responseStartTimestampTwilio = null;

        const openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01&temperature=${TEMPERATURE}`, {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            }
        });

        // Control initial session with OpenAI
        const initializeSession = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    type: 'realtime',
                    model: "gpt-4o-realtime-preview-2024-10-01",
                    output_modalities: ["audio"],
                    audio: {
                        input: { format: { type: 'audio/pcmu' }, turn_detection: { type: "server_vad" } },
                        output: { format: { type: 'audio/pcmu' }, voice: VOICE },
                    },
                    instructions: SYSTEM_MESSAGE,
                },
            };

            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));

            // Uncomment the following line to have AI speak first:
        //sendInitialConversationItem();
        };

        // Send initial conversation item if AI talks first
        const sendInitialConversationItem = () => {
    const initialConversationItem = {
        type: 'conversation.item.create',
        item: {
            type: 'message',
            role: 'user',
            content: [
                {
                    type: 'input_text',
                    text: 'Diga: Oi, tudo bem? sou uma agente speetch to speetch da Olos. Como posso ajudar você hoje?'
                }
            ]
        }
    };

            if (SHOW_TIMING_MATH) console.log('Sending initial conversation item:', JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify({ type: 'response.create' }));
        };

        // Handle interruption when the caller's speech starts
        const handleSpeechStartedEvent = () => {
            if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
                const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
                if (SHOW_TIMING_MATH) console.log(`Calculating elapsed time for truncation: ${latestMediaTimestamp} - ${responseStartTimestampTwilio} = ${elapsedTime}ms`);

                if (lastAssistantItem) {
                    const truncateEvent = {
                        type: 'conversation.item.truncate',
                        item_id: lastAssistantItem,
                        content_index: 0,
                        audio_end_ms: elapsedTime
                    };
                    if (SHOW_TIMING_MATH) console.log('Sending truncation event:', JSON.stringify(truncateEvent));
                    openAiWs.send(JSON.stringify(truncateEvent));
                }

                connection.send(JSON.stringify({
                    event: 'clear',
                    streamSid: streamSid
                }));

                // Reset
                markQueue = [];
                lastAssistantItem = null;
                responseStartTimestampTwilio = null;
            }
        };

        // Send mark messages to Media Streams so we know if and when AI response playback is finished
        const sendMark = (connection, streamSid) => {
            if (streamSid) {
                const markEvent = {
                    event: 'mark',
                    streamSid: streamSid,
                    mark: { name: 'responsePart' }
                };
                connection.send(JSON.stringify(markEvent));
                markQueue.push('responsePart');
            }
        };

        // Open event for OpenAI WebSocket
        openAiWs.on('open', () => {
            console.log('Connected to the OpenAI Realtime API');
            setTimeout(initializeSession, 100);
        });

        // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
        openAiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data);

                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`Received event: ${response.type}`, response);
                }

                if (response.type === 'response.output_audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: response.delta }
                    };
                    connection.send(JSON.stringify(audioDelta));

                    // First delta from a new response starts the elapsed time counter
                    if (!responseStartTimestampTwilio) {
                        responseStartTimestampTwilio = latestMediaTimestamp;
                        if (SHOW_TIMING_MATH) console.log(`Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`);
                    }

                    if (response.item_id) {
                        lastAssistantItem = response.item_id;
                    }
                    
                    sendMark(connection, streamSid);
                }

                if (response.type === 'input_audio_buffer.speech_started') {
                    handleSpeechStartedEvent();
                }
            } catch (error) {
                console.error('Error processing OpenAI message:', error, 'Raw message:', data);
            }
        });

        // Handle incoming messages from Twilio
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case 'media':
                        latestMediaTimestamp = data.media.timestamp;
                        if (SHOW_TIMING_MATH) console.log(`Received media message with timestamp: ${latestMediaTimestamp}ms`);
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload
                            };
                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                    case 'start':
                        streamSid = data.start.streamSid;
                        console.log('Incoming stream has started', streamSid);
                        callSid = data.start.callSid;
console.log('Call SID:', callSid);

                        // Reset start and media timestamp on a new stream
                        responseStartTimestampTwilio = null; 
                        latestMediaTimestamp = 0;
                        break;
                    case 'mark':
                        if (markQueue.length > 0) {
                            markQueue.shift();
                        }
                        break;
                    default:
                        console.log('Received non-media event:', data.event);
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error, 'Message:', message);
            }
        });

        // Handle connection close
        connection.on('close', () => {
            // ========================================
        // 📊 SALVAR TABULAÇÃO DA CHAMADA
        // ========================================
        const fim = new Date();
        const inicio = new Date(dadosChamada.inicio);
        dadosChamada.fim = fim.toISOString();
        dadosChamada.duracao_segundos = Math.floor((fim - inicio) / 1000);
        dadosChamada.callSid = callSid;
        dadosChamada.streamSid = streamSid;
        
        // SALVAR
        salvarTabulacao(dadosChamada);
        // ========================================
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
            console.log('Client disconnected.');
        });

        // Handle WebSocket close and errors
        openAiWs.on('close', () => {
            console.log('Disconnected from the OpenAI Realtime API');
        });

        openAiWs.on('error', (error) => {
            console.error('Error in the OpenAI WebSocket:', error);
        });
    });
});

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server is listening on port ${PORT}`);
});

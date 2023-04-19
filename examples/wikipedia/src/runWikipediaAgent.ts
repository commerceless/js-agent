import * as $ from "js-agent";

export async function runWikipediaAgent({
  wikipediaSearchKey,
  wikipediaSearchCx,
  openAiApiKey,
  objective,
}: {
  openAiApiKey: string;
  wikipediaSearchKey: string;
  wikipediaSearchCx: string;
  objective: string;
}) {
  const searchWikipediaAction = $.tool.programmableGoogleSearchEngineAction({
    id: "search-wikipedia",
    description:
      "Search wikipedia using a search term. Returns a list of pages.",
    execute: $.tool.executeProgrammableGoogleSearchEngineAction({
      key: wikipediaSearchKey,
      cx: wikipediaSearchCx,
    }),
  });

  const chatGpt = $.provider.openai.chatModel({
    apiKey: openAiApiKey,
    model: "gpt-3.5-turbo",
  });

  const readWikipediaArticleAction = $.tool.summarizeWebpage({
    id: "read-wikipedia-article",
    description:
      "Read a wikipedia article and summarize it considering the query.",
    inputExample: {
      url: "https://en.wikipedia.org/wiki/Artificial_intelligence",
      topic: "{query that you are answering}",
    },
    execute: $.tool.executeSummarizeWebpage({
      extractText: $.text.extractWebpageTextFromHtml(),
      summarize: $.text.summarizeRecursively({
        split: $.text.splitRecursivelyAtCharacter({
          maxCharactersPerChunk: 2048 * 4, // needs to fit into a gpt-3.5-turbo prompt
        }),
        summarize: $.text.generate({
          id: "summarize-wikipedia-article-chunk",
          prompt: $.text.SummarizeChatPrompt,
          model: chatGpt,
          processOutput: async (output) => output.trim(),
        }),
      }),
    }),
  });

  return $.runAgent({
    objective,
    agent: $.step.createGenerateNextStepLoop({
      actionRegistry: new $.action.ActionRegistry({
        actions: [searchWikipediaAction, readWikipediaArticleAction],
        format: new $.action.format.FlexibleJsonActionFormat(),
      }),
      prompt: $.prompt.concatChatPrompts<$.step.GenerateNextStepLoopContext>(
        $.prompt.sectionsChatPrompt({
          role: "system",
          getSections: async () => [
            {
              title: "Role",
              // "You speak perfect JSON" helps getting gpt-3.5-turbo to provide structured json at the end
              content: `You are an knowledge worker that answers questions using Wikipedia content. You speak perfect JSON.`,
            },
            {
              title: "Constraints",
              content: `Make sure all facts for your answer are from Wikipedia articles that you have read.`,
            },
          ],
        }),
        $.prompt.taskChatPrompt(),
        $.prompt.availableActionsChatPrompt(),
        $.prompt.recentStepsChatPrompt({ maxSteps: 6 })
      ),
      model: chatGpt,
    }),
    controller: $.agent.controller.maxSteps(20),
    observer: $.agent.observer.combineObservers(
      $.agent.observer.showRunInConsole({ name: "Wikipedia Agent" }),
      {
        async onRunFinished({ run }) {
          const runCostInMillicent = await $.agent.calculateRunCostInMillicent({
            run,
          });

          console.log(
            `Run cost: $${(runCostInMillicent / 1000 / 100).toFixed(2)}`
          );

          console.log(
            `LLM calls: ${
              run.recordedCalls.filter((call) => call.success).length
            }`
          );
        },
      }
    ),
  });
}

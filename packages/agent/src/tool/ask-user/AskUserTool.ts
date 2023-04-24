import readline from "readline";
import zod from "zod";
import { FormatResultFunction } from "../../action";
import { ExecuteToolFunction } from "../ExecuteToolFunction";
import { createToolAction } from "../ToolAction";

export type AskUserInput = {
  query: string;
};

export type AskUserOutput = {
  response: string;
};

export const askUser = ({
  id = "ask-user",
  description = "Ask the user for input or to take an action.",
  inputExample = {
    query: "{question or action description}",
  },
  execute,
  formatResult = ({ input, output: { response } }) =>
    `${input.query}: ${response}`,
}: {
  id?: string;
  description?: string;
  inputExample?: AskUserInput;
  execute: ExecuteToolFunction<AskUserInput, AskUserOutput>;
  formatResult?: FormatResultFunction<AskUserInput, AskUserOutput>;
}) =>
  createToolAction({
    id,
    description,
    inputSchema: zod.object({
      query: zod.string(),
    }),
    outputSchema: zod.object({
      response: zod.string(),
    }),
    inputExample,
    execute,
    formatResult,
  });

export const executeAskUser =
  <RUN_STATE>(): ExecuteToolFunction<AskUserInput, AskUserOutput> =>
  async ({ input: { query } }) => {
    const userInput = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const response = await new Promise<string>((resolve) => {
      userInput.question(query, (answer) => {
        resolve(answer);
        userInput.close();
      });
    });

    return {
      summary: `User response: ${response}`,
      output: { response },
    };
  };

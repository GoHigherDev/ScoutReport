import { keccak256, toBytes, type Abi, type Address, type Hex } from 'viem'
import surveyJson from '../../abis/survey3.json' with { type: 'json' }
import { cli, type Probe } from './common.ts'

export const surveyAbi = surveyJson as Abi
export const POLLS: readonly Address[] = [
  '0xc145fea14431b05f4048e13ef679079b6ff38747',
  '0x51f5b6fa10146420c2445017e02c9f4a8d31cf53',
]
export const VOTER: Address = '0x57263860374550da427dad543439165e1540e29c'
export const VOTE_TOPIC: Hex =
  '0xd6a7c7a36d76a0cfc7614e4d4d0964958841ee423af68cb1b56add38c7b491dd'

type Answer = {
  id: string
  text: string
  totalVotes: bigint
  totalTokens: bigint
}
export const matchAnswers = (answers: Answer[], hashes: readonly Hex[]) =>
  hashes.map((hash) => ({
    hash,
    answer:
      answers.find((answer) => keccak256(toBytes(answer.id)) === hash) ?? null,
  }))

export const probePolls: Probe = async ({ client, blockNumber, record }) => {
  for (const address of POLLS) {
    const read = (functionName: string, args: readonly unknown[] = []) =>
      client.readContract({
        address,
        abi: surveyAbi,
        functionName,
        args,
        blockNumber,
      })
    const prefix = `poll.${address}`
    await Promise.all(
      [
        'question',
        'questionId',
        'startDate',
        'endDate',
        'getState',
        'isBinding',
        'votingCap',
        'getTotalVoters',
        'getTotalOwners',
        'getTotalTokensUsed',
        'whitelistEnabled',
      ].map((name) => record(`${prefix}.${name}`, () => read(name))),
    )
    await record(`${prefix}.getQuorum.scalePow0`, () => read('getQuorum', [0]))
    const [answers, hashes] = await Promise.all([
      record(
        `${prefix}.getAnswers`,
        async () => (await read('getAnswers')) as Answer[],
      ),
      record(
        `${prefix}.getUserAnswers`,
        async () => (await read('getUserAnswers', [VOTER])) as Hex[],
      ),
    ])
    if (answers) {
      await Promise.all(
        answers.map((answer, index) =>
          Promise.all([
            record(`${prefix}.getAnswer.${index}`, () =>
              read('getAnswer', [answer.id]),
            ),
            record(`${prefix}.getAnswerIdsByIndex.${index}`, () =>
              read('getAnswerIdsByIndex', [BigInt(index)]),
            ),
          ]),
        ),
      )
      if (hashes)
        await record(`${prefix}.matchedUserAnswers`, async () =>
          matchAnswers(answers, hashes),
        )
    }
    if (hashes)
      await Promise.all(
        hashes.map((hash) =>
          record(`${prefix}.getUserVoteByAnswer.${hash}`, () =>
            read('getUserVoteByAnswer', [VOTER, hash]),
          ),
        ),
      )
  }
  await record('poll.discoveryVoteLogs', () =>
    client.request({
      method: 'eth_getLogs',
      params: [
        {
          fromBlock: `0x${(blockNumber > 49_999n ? blockNumber - 49_999n : 0n).toString(16)}`,
          toBlock: `0x${blockNumber.toString(16)}`,
          topics: [VOTE_TOPIC],
        },
      ],
    }),
  )
}

await cli(import.meta.url, [probePolls])

/**
 * @description 为了保证相同的内容每次生成的随机数都是一样的，我们可以使用一个伪随机数生成器（PRNG），并使用内容的哈希值作为种子。以下是一个使用Mersenne Twister算法的PRNG的实现：
 *
 * @param {*} seed
 */
export default function MersenneTwister(seed: any): void

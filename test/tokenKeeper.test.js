const Token = artifacts.require("Token");
const TokenKeeper = artifacts.require("TokenKeeper");
const catchRevert = require("./exceptionsHelpers.js").catchRevert;

require("./utils");

// TODO:
const TOKENS_OPENED = web3.utils.toWei("3");
const TOKENS_LOCKED = web3.utils.toWei("5");
const HUNDRED_TOKEN = web3.utils.toWei("100");

contract("TokenKeeper", ([owner, alice, bob, random]) => {

    let token;
    let tokenKeeper;

    beforeEach(async () => {
        // TODO: check minTimeFrame and tokenAddress
        token = await Token.new();
        tokenKeeper = await TokenKeeper.new(
            owner,
            300,
            token.address
        );

        token.transfer(
            tokenKeeper.address,
            HUNDRED_TOKEN
        );
    });

    describe("Allocation Functionality", () => {

        it("should not allocate tokens with invalid time frame", async () => {
            const currentTime = await tokenKeeper.getNow();
            const timeFrame = currentTime - 10;

            let Error;
            try {
                await tokenKeeper.allocateTokens(
                    owner,
                    TOKENS_OPENED,
                    TOKENS_LOCKED,
                    timeFrame
                );
            } catch (error) {
                Error = error;
            }

            assert.notEqual(
                Error,
                undefined
            );

            assert.equal(
                Error.reason,
                "TokenKeeper: INVALID_TIME_FRAME"
            );
        });

        it("should allocate correct values", async () => {

            const currentTime = await tokenKeeper.getNow();
            const timeFrame = currentTime + 10;

            await tokenKeeper.allocateTokens(
                owner,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            const keeper = await tokenKeeper.keeperList.call(
                alice
            );

            const totalRequired = await tokenKeeper.totalRequired.call();

            assert.equal(
                keeper.keeperRate,
                Math.trunc(TOKENS_LOCKED / timeFrame)
            );

            assert.equal(
                keeper.keeperBalance,
                TOKENS_LOCKED % timeFrame + TOKENS_OPENED
            );

            assert.equal(
                keeper.keeperBalance,
                TOKENS_LOCKED % timeFrame + TOKENS_OPENED
            );

            assert.equal(
                totalRequired,
                TOKENS_OPENED + TOKENS_LOCKED
            );
        });
    })
})

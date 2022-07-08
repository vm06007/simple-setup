const TokenKeeper = artifacts.require("TokenKeeper");
const catchRevert = require("./exceptionsHelpers.js").catchRevert;

require("./utils");

// TODO:
const TOKENS_OPENED = web3.utils.toWei("3");
const TOKENS_LOCKED = web3.utils.toWei("5");

contract("TokenKeeper", ([owner, alice, bob, random]) => {

    let tokenKeeper;

    beforeEach(async () => {
        // TODO: check params
        tokenKeeper = await TokenKeeper.new(owner, 10, alice);
    });

    describe("Allocation Functionality", () => {

        it("should allocate correct values", () => {
            const currentTime = await tokenKeeper.getNow();
            const timeFrame = currentTime + 10;

            await tokenKeeper.allocateToken(
                alice,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            const keeper = await tokenKeeper.keeperList.call(alice);
            const totalRequired = await tokenKeeper.totalRequired.call();
            
            assert.equal(keeper.keeperRate, TOKENS_LOCKED / timeFrame);
            assert.equal(keeper.keeperBalance, TOKENS_LOCKED % timeFrame + TOKENS_OPENED);
            assert.equal(keeper.keeperBalance, TOKENS_LOCKED % timeFrame + TOKENS_OPENED);
            assert.equal(totalRequired, TOKENS_OPENED + TOKENS_LOCKED);


        });

        it("should not allocate tokens with invalid time frame", () => {
            const currentTime = await tokenKeeper.getNow();
            const timeFrame = currentTime - 10;

            await tokenKeeper.allocateToken(
                alice,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            )

            const keeper = await tokenKeeper.keeperList.call(alice);

            assert.equal(keeper.keeperBalance, 0)
        });
    })

})


// SPDX-License-Identifier: --VM06007--

pragma solidity =0.8.13;

contract TokenKeeper {

    address public tokenKeeper;
    uint256 public totalRequired;

    uint256 immutable minTimeFrame;
    address immutable tokenAddress;

    struct KeeperInfo {
        uint256 keeperRate;
        uint256 keeperFrom;
        uint256 keeperTill;
        uint256 keeperBalance;
        uint256 keeperPayouts;
    }

    mapping(address => KeeperInfo) public keeperList;

    modifier onlyTokenKeeper() {
        require(
            msg.sender == tokenKeeper,
            "TokenKeeper: ACCESS_DENIED"
        );
        _;
    }

    event recipientCreated(
        address indexed recipient,
        uint256 timeLock,
        uint256 timeReward,
        uint256 instantReward,
        uint256 timestamp
    );

    event tokensScraped(
        address indexed scraper,
        uint256 scrapedAmount,
        uint256 timestamp
    );

    constructor(
        address _tokenKeeper,
        uint256 _minTimeFrame,
        address _tokenAddress
    ) {
        if (_tokenKeeper == address(0)) {
            revert("TokenKeeper: INVALID_KEEPER");
        }

        if (_minTimeFrame == 0) {
            revert("TokenKeeper: INVALID_TIMEFRAME");
        }

        if (_tokenAddress == address(0)) {
            revert("TokenKeeper: INVALID_TOKEN");
        }

        tokenKeeper = _tokenKeeper;
        minTimeFrame = _minTimeFrame;
        tokenAddress = _tokenAddress;
    }

    function allocateTokensBulk(
        address[] memory _recipients,
        uint256[] memory _tokensOpened, // available instantly
        uint256[] memory _tokensLocked, // locked amount
        uint256[] memory _timeFrame // lock period
    )
        external 
        onlyTokenKeeper /** only msg.sender can allocate */
    {
        for (uint256 i = 0; i < _recipients.length; i++) {
            allocateTokens(
                _recipients[i],
                _tokensOpened[i],
                _tokensLocked[i],
                _timeFrame[i]
            );
        }
    }

    function allocateTokens(
        address _recipient,
        uint256 _tokensOpened, // available instantly
        uint256 _tokensLocked, // locked amount
        uint256 _timeFrame // lock period
    )
        public
        onlyTokenKeeper /** only msg.sender can allocate */
    {
        require(
            _timeFrame >= minTimeFrame,
            "TokenKeeper: INVALID_TIME_FRAME"
        );

        totalRequired = totalRequired
            + _tokensOpened
            + _tokensLocked;

        // validate token address balance
        _checkTokenBalance(
            totalRequired
        );

        uint256 timestamp = getNow();

        // add allocation to keeper list
        keeperList[_recipient].keeperFrom = timestamp;
        keeperList[_recipient].keeperTill = timestamp
            + _timeFrame;

        keeperList[_recipient].keeperRate = _tokensLocked
            / _timeFrame;

        keeperList[_recipient].keeperBalance = _tokensLocked
            % _timeFrame
            + _tokensOpened;

        emit recipientCreated(
            _recipient,
            _timeFrame,
            _tokensLocked,
            _tokensOpened,
            timestamp
        );
    }

    function scrapeMyTokens()
        external
    {
        _scrapeTokens(
            msg.sender
        );
    }

    function _scrapeTokens(
        address _recipient
    )
        private
    {
        // get calculated allocation balance
        uint256 scrapeAmount = availableBalance(
            _recipient
        );

        // add scrape amount to recipient payout
        keeperList[_recipient].keeperPayouts += scrapeAmount;

        // transfer scrape amount to recipient address
        _safeTokenScrape(
            _recipient,
            scrapeAmount
        );

        emit tokensScraped(
            _recipient,
            scrapeAmount,
            getNow()
        );
    }

    function availableBalance(
        address _recipient
    )
        public
        view
        returns (uint256 balance)
    {
        /**
            if current time is within timeFrame,
            timePassed is diff between now and allocation time else 
            timePassed is allocation timeFrame
        */
        uint256 timePassed =
            getNow() < keeperList[_recipient].keeperTill ?
            getNow() - keeperList[_recipient].keeperFrom : _diff(_recipient);

        balance = keeperList[_recipient].keeperRate
            * timePassed
            + keeperList[_recipient].keeperBalance
            - keeperList[_recipient].keeperPayouts;
    }

    function lockedBalance(
        address _recipient
    )
        external
        view
        returns (uint256 balance)
    {
        /**
            if current time is before allocation timeFrame
            timeRemaining is time passed since allocation timeFrame
         */
        uint256 timeRemaining =
            keeperList[_recipient].keeperTill > getNow() ?
            keeperList[_recipient].keeperTill - getNow() : 0;

        balance = keeperList[_recipient].keeperRate
            * timeRemaining;
    }

    function getNow()
        public
        view
        returns (uint256 time)
    {
        time = block.timestamp;
    }

    function renounceOwnership()
        external
        onlyTokenKeeper
    {
        delete tokenKeeper;
    }

    function _diff(
        address _recipient
    )
        private
        view
        returns (uint256 res)
    {
        // get timeFrame
        res = keeperList[_recipient].keeperTill
            - keeperList[_recipient].keeperFrom;
    }

    bytes4 private constant TRANSFER = bytes4(
        keccak256(
            bytes(
                "transfer(address,uint256)"
            )
        )
    );

    bytes4 private constant BALANCEOF = bytes4(
        keccak256(
            bytes(
                "balanceOf(address)"
            )
        )
    );

    function _safeTokenScrape(
        address _to,
        uint256 _scrapeAmount
    )
        private
    {
        // remove scrape amount from token totalRequired
        totalRequired -= _scrapeAmount;

        // transfer scrape amount to recipient
        (bool success, bytes memory data) = tokenAddress.call(
            abi.encodeWithSelector(
                TRANSFER,
                _to,
                _scrapeAmount
            )
        );

        require(
            success && (
                data.length == 0 || abi.decode(
                    data, (bool)
                )
            ),
            "TokenKeeper: TRANSFER_FAILED"
        );
    }

    function _checkTokenBalance(
        uint256 _required
    )
        private
    {
        (bool success, bytes memory data) = tokenAddress.call(
            abi.encodeWithSelector(
                BALANCEOF,
                address(this)
            )
        );

        // check if token address balance is greater that totalRequired
        require(
            success && abi.decode(
                data, (uint256)
            ) >= _required,
            "TokenKeeper: BALANCE_CHECK_FAILED"
        );
    }
}

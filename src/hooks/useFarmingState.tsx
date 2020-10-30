import { useCallback, useContext, useEffect, useState } from "react";

import { ethers } from "ethers";
import useAsyncEffect from "use-async-effect";
import { LPTokenSelectFilter } from "../components/LPTokenSelect";
import { MASTER_CHEF } from "../constants/contracts";
import { EthersContext } from "../context/EthersContext";
import { parseBalance } from "../utils";
import useLPTokensState, { LPTokensState } from "./useLPTokensState";
import useSDK from "./useSDK";

export interface FarmingState extends LPTokensState {
    action?: Action;
    setAction: (action?: Action) => void;
    expectedSushiRewardPerBlock?: ethers.BigNumber;
    filteredBy: LPTokenSelectFilter;
    setFilteredBy: (filter: LPTokenSelectFilter) => void;
    onDeposit: () => Promise<void>;
    depositing: boolean;
    onWithdraw: () => Promise<void>;
    withdrawing: boolean;
}

export type Action = "deposit" | "withdraw";

// tslint:disable-next-line:max-func-body-length
const useFarmingState: () => FarmingState = () => {
    const state = useLPTokensState("pools");
    const { provider, signer, getTokenAllowance } = useContext(EthersContext);
    const { getExpectedSushiRewardPerBlock, deposit, withdraw } = useSDK();
    const [filteredBy, setFilteredBy] = useState("" as LPTokenSelectFilter);
    const [action, setAction] = useState<Action>();
    const [loading, setLoading] = useState(false);
    const [expectedSushiRewardPerBlock, setExpectedSushiRewardPerBlock] = useState<ethers.BigNumber>();
    const [depositing, setDepositing] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);

    useEffect(() => {
        setFilteredBy("");
        setAction(undefined);
        setLoading(false);
        setDepositing(false);
        setWithdrawing(false);
        setExpectedSushiRewardPerBlock(undefined);
    }, [state.selectedLPToken]);

    useAsyncEffect(async () => {
        if (signer && state.selectedLPToken) {
            setLoading(true);
            try {
                setExpectedSushiRewardPerBlock(await getExpectedSushiRewardPerBlock(state.selectedLPToken, signer));
            } finally {
                setLoading(false);
            }
        }
    }, [signer, state.selectedLPToken]);

    useAsyncEffect(async () => {
        if (provider && signer && state.selectedLPToken) {
            setLoading(true);
            state.setSelectedLPTokenAllowed(false);
            try {
                const minAllowance = ethers.BigNumber.from(2)
                    .pow(96)
                    .sub(1);
                const allowance = await getTokenAllowance(state.selectedLPToken.address, MASTER_CHEF);
                state.setSelectedLPTokenAllowed(ethers.BigNumber.from(allowance).gte(minAllowance));
            } finally {
                setLoading(false);
            }
        }
    }, [provider, signer, state.selectedLPToken]);

    useEffect(() => {
        state.setAmount("");
    }, [action]);

    const onDeposit = useCallback(async () => {
        if (state.selectedLPToken?.id && state.amount && signer) {
            setDepositing(true);
            try {
                const amount = parseBalance(state.amount, state.selectedLPToken.decimals);
                const tx = await deposit(state.selectedLPToken.id, amount, signer);
                await tx.wait();
                state.setSelectedLPToken(undefined);
                await state.updateLastTimeRefreshed();
            } finally {
                setDepositing(false);
            }
        }
    }, [state.selectedLPToken, state.amount, signer]);

    const onWithdraw = useCallback(async () => {
        if (state.selectedLPToken?.id && state.amount && signer) {
            setWithdrawing(true);
            try {
                const amount = parseBalance(state.amount, state.selectedLPToken.decimals);
                const tx = await withdraw(state.selectedLPToken.id, amount, signer);
                await tx.wait();
                state.setSelectedLPToken(undefined);
                await state.updateLastTimeRefreshed();
            } finally {
                setWithdrawing(false);
            }
        }
    }, [state.selectedLPToken, state.amount, signer]);

    return {
        ...state,
        loading: state.loading || loading,
        filteredBy,
        setFilteredBy,
        action,
        setAction,
        expectedSushiRewardPerBlock,
        onDeposit,
        depositing,
        onWithdraw,
        withdrawing
    };
};

export default useFarmingState;

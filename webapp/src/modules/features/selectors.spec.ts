import { Item } from '@dcl/schemas'
import { INITIAL_STATE } from 'decentraland-dapps/dist/modules/features/reducer'
import { getIsFeatureEnabled, hasLoadedInitialFlags } from 'decentraland-dapps/dist/modules/features/selectors'
import { ApplicationName } from 'decentraland-dapps/dist/modules/features/types'
import { RootState } from '../reducer'
import {
  getIsCampaignBrowserEnabled,
  getIsCampaignCollectiblesBannerEnabled,
  getIsCampaignHomepageBannerEnabled,
  getIsMaintenanceEnabled,
  getIsMarketplaceLaunchPopupEnabled,
  isLoadingFeatureFlags,
  getIsBidsOffChainEnabled,
  getIsOffchainPublicNFTOrdersEnabled,
  getIsOffchainPublicItemOrdersEnabled,
  getIsCreditsSecondarySalesEnabled,
  getIsUnityWearablePreviewEnabled
} from './selectors'
import { FeatureName } from './types'

jest.mock('decentraland-dapps/dist/modules/features/selectors', () => {
  const originalModule = jest.requireActual('decentraland-dapps/dist/modules/features/selectors')

  return {
    __esModule: true,
    ...originalModule,
    getIsFeatureEnabled: jest.fn(),
    hasLoadedInitialFlags: jest.fn()
  } as unknown
})

let state: RootState
let getIsFeatureEnabledMock: jest.MockedFunction<typeof getIsFeatureEnabled>
let hasLoadedInitialFlagsMock: jest.MockedFunction<typeof hasLoadedInitialFlags>

beforeEach(() => {
  state = {
    features: {
      ...INITIAL_STATE,
      data: {
        anItemId: {} as Item
      },
      error: 'anError',
      loading: []
    }
  } as any
  getIsFeatureEnabledMock = getIsFeatureEnabled as jest.MockedFunction<typeof getIsFeatureEnabled>
  hasLoadedInitialFlagsMock = hasLoadedInitialFlags as jest.MockedFunction<typeof hasLoadedInitialFlags>
})

describe('when getting the loading state of the features state', () => {
  it('should return the loading state', () => {
    expect(isLoadingFeatureFlags(state)).toEqual(state.features.loading)
  })
})

const tryCatchSelectors = [
  {
    name: 'IsMaintenance',
    feature: FeatureName.MAINTENANCE,
    selector: getIsMaintenanceEnabled
  },
  {
    name: 'IsMarketplaceLaunchPopup',
    feature: FeatureName.LAUNCH_POPUP,
    selector: getIsMarketplaceLaunchPopupEnabled
  },
  {
    name: 'IsCampaignHomepageBanner',
    feature: FeatureName.CAMPAIGN_HOMEPAGE_BANNER,
    selector: getIsCampaignHomepageBannerEnabled
  },
  {
    name: 'IsCampaignCollectionsBanner',
    feature: FeatureName.CAMPAIGN_COLLECTIBLES_BANNER,
    selector: getIsCampaignCollectiblesBannerEnabled
  },
  {
    name: 'IsCampaignBrowser',
    feature: FeatureName.CAMPAIGN_BROWSER,
    selector: getIsCampaignBrowserEnabled
  }
]

tryCatchSelectors.forEach(({ name, feature, selector }) =>
  describe(`when getting if the ${name} feature flag is enabled`, () => {
    describe('when the isFeatureEnabled selector fails', () => {
      beforeEach(() => {
        getIsFeatureEnabledMock.mockImplementationOnce(() => {
          throw new Error()
        })
      })

      it('should return false', () => {
        const isEnabled = selector(state)

        expect(isEnabled).toBe(false)
        expect(getIsFeatureEnabledMock).toHaveBeenCalledWith(state, ApplicationName.MARKETPLACE, feature)
      })
    })

    describe('when the feature is not enabled', () => {
      beforeEach(() => {
        getIsFeatureEnabledMock.mockReturnValueOnce(false)
      })

      it('should return false', () => {
        const isEnabled = selector(state)

        expect(isEnabled).toBe(false)
        expect(getIsFeatureEnabledMock).toHaveBeenCalledWith(state, ApplicationName.MARKETPLACE, feature)
      })
    })

    describe('when the feature is enabled', () => {
      beforeEach(() => {
        getIsFeatureEnabledMock.mockReturnValueOnce(true)
      })

      it('should return true', () => {
        const isEnabled = selector(state)

        expect(isEnabled).toBe(true)
        expect(getIsFeatureEnabledMock).toHaveBeenCalledWith(state, ApplicationName.MARKETPLACE, feature)
      })
    })
  })
)

const waitForInitialLoadingSelectors = [
  {
    name: 'IsBidsOffChainEnabled',
    feature: FeatureName.OFFCHAIN_BIDS,
    selector: getIsBidsOffChainEnabled,
    applicationName: ApplicationName.MARKETPLACE
  },
  {
    name: 'IsOffchainPublicNFTOrdersEnabled',
    feature: FeatureName.OFFCHAIN_PUBLIC_NFT_ORDERS,
    selector: getIsOffchainPublicNFTOrdersEnabled,
    applicationName: ApplicationName.MARKETPLACE
  },
  {
    name: 'IsfOffchainPublicItemOrdersEnabled',
    feature: FeatureName.OFFCHAIN_PUBLIC_ITEM_ORDERS,
    selector: getIsOffchainPublicItemOrdersEnabled,
    applicationName: ApplicationName.DAPPS
  },
  {
    name: 'IsCreditsSecondarySalesEnabled',
    feature: FeatureName.CREDITS_SECONDARY_SALES,
    selector: getIsCreditsSecondarySalesEnabled,
    applicationName: ApplicationName.MARKETPLACE
  },
  {
    name: 'IsUnityWearablePreviewEnabled',
    feature: FeatureName.UNITY_WEARABLE_PREVIEW,
    selector: getIsUnityWearablePreviewEnabled,
    applicationName: ApplicationName.DAPPS
  }
]

waitForInitialLoadingSelectors.forEach(({ name, feature, applicationName, selector }) =>
  describe(`when getting if the ${name} feature flag is enabled`, () => {
    describe('when the initial flags have not been yet loaded', () => {
      beforeEach(() => {
        hasLoadedInitialFlagsMock.mockReturnValueOnce(false)
      })

      it('should return false', () => {
        const isEnabled = selector(state)

        expect(isEnabled).toBe(false)
      })
    })

    describe('when the initial flags have been loaded', () => {
      beforeEach(() => {
        hasLoadedInitialFlagsMock.mockReturnValueOnce(true)
      })

      describe('when the feature is not enabled', () => {
        beforeEach(() => {
          getIsFeatureEnabledMock.mockReturnValueOnce(false)
        })

        it('should return false', () => {
          const isEnabled = selector(state)

          expect(isEnabled).toBe(false)
          expect(getIsFeatureEnabledMock).toHaveBeenCalledWith(state, applicationName || ApplicationName.MARKETPLACE, feature)
        })
      })

      describe('when the feature is enabled', () => {
        beforeEach(() => {
          getIsFeatureEnabledMock.mockReturnValueOnce(true)
        })

        it('should return true', () => {
          const isEnabled = selector(state)

          expect(isEnabled).toBe(true)
          expect(getIsFeatureEnabledMock).toHaveBeenCalledWith(state, applicationName || ApplicationName.MARKETPLACE, feature)
        })
      })
    })
  })
)

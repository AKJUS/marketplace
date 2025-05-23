import React, { ReactNode, useEffect, useState } from 'react'
import { matchPath, useHistory, useLocation } from 'react-router-dom'
import classNames from 'classnames'
import { t } from 'decentraland-dapps/dist/modules/translation/utils'
import { BackToTopButton, Mobile, NotMobile, Page, Tabs } from 'decentraland-ui'
import { usePagination } from '../../lib/pagination'
import { locations } from '../../modules/routing/locations'
import { BrowseOptions } from '../../modules/routing/types'
import { ExtendedHistory } from '../../modules/types'
import { View } from '../../modules/ui/types'
import { getPersistedIsMapProperty, isAccountView, isListsSection } from '../../modules/ui/utils'
import { Section as DecentralandSection } from '../../modules/vendor/decentraland'
import { Sections } from '../../modules/vendor/routing/types'
import { AssetStatusFilter } from '../../utils/filters'
import { AccountSidebar } from '../AccountSidebar'
import { AssetList } from '../AssetList'
import AssetTopbar from '../AssetTopbar'
import { Bids } from '../Bids'
import CollectionList from '../CollectionList'
import { Column } from '../Layout/Column'
import { Row } from '../Layout/Row'
import OnSaleList from '../OnSaleOrRentList'
import { OnSaleOrRentType } from '../OnSaleOrRentList/OnSaleOrRentList.types'
import Sales from '../Sales'
import StoreSettings from '../StoreSettings'
import { NFTSidebar } from '../Vendor/NFTSidebar'
import MapBrowse from './MapBrowse'
import MapTopbar from './MapTopbar'
import { Props } from './AssetBrowse.types'
import './AssetBrowse.css'

const AssetBrowse = (props: Props) => {
  const {
    vendor,
    view,
    isMap,
    isFullscreen,
    address,
    contracts,
    onSetView,
    onFetchAssetsFromRoute,
    onBrowse,
    section,
    sections,
    onlyOnSale,
    onlySmart,
    viewInState,
    disableSearchDropdown,
    onlyOnRent,
    status
  } = props

  const location = useLocation()
  const history = useHistory() as ExtendedHistory
  const { changeFilter } = usePagination()

  // Prevent fetching more than once while browsing
  const visitedLocations = history.getLastVisitedLocations()
  const lastLocation = visitedLocations[visitedLocations.length - 2]
  const [hasFetched, setHasFetched] = useState(
    history.action === 'POP' &&
      lastLocation?.pathname === location.pathname &&
      lastLocation?.search === location.search &&
      // We're re-fetching items when going back into a list
      location.pathname === locations.list()
  )
  const isCurrentAccount = view === View.CURRENT_ACCOUNT
  const isAccountOrCurrentAccount = view === View.ACCOUNT || isCurrentAccount
  const [showOwnedLandOnMap, setShowOwnedLandOnMap] = useState(true)

  // Kick things off
  useEffect(() => {
    onSetView(view)
  }, [onSetView, view])

  // When the view changes, we unset the hasFetched flag
  useEffect(() => {
    if (view !== viewInState) {
      setHasFetched(false)
    }
  }, [view, viewInState])

  const isMapPropertyPersisted = getPersistedIsMapProperty()

  useEffect(() => {
    const cancelListener = history.listen((_location, action) => {
      if (action === 'POP') {
        setHasFetched(false)
      }
    })
    return () => {
      cancelListener()
    }
  }, [history])

  useEffect(() => {
    if (section === DecentralandSection.LAND && !isAccountView(view) && isMapPropertyPersisted === false && isMap) {
      // To prevent the map view from being displayed when the user clicks on the Land navigation tab.
      // We set the has fetched variable to false so it has to browse back to the list view.
      setHasFetched(false)
    }
  }, [section, view, isMap, isMapPropertyPersisted])

  useEffect(() => {
    if (viewInState === view && !hasFetched && section !== DecentralandSection.COLLECTIONS) {
      // Options used to fetch the assets.
      const browseOpts: BrowseOptions = {
        vendor,
        view,
        section,
        address,
        contracts,
        onlyOnSale,
        onlySmart,
        status
      }

      // Function used to fetch the assets.
      let fetchAssetsFn: (opts: BrowseOptions) => void = onFetchAssetsFromRoute

      if (section === DecentralandSection.LAND && !isAccountView(view) && isMapPropertyPersisted === false) {
        const previousPageIsLandDetail = !!matchPath(visitedLocations[1]?.pathname, { path: locations.nft(), strict: true, exact: true })
        // Update the browser options to match the ones persisted.
        browseOpts.isMap = isMap
        browseOpts.isFullscreen = isFullscreen
        browseOpts.onlyOnSale =
          (!onlyOnSale && onlyOnRent === false && !previousPageIsLandDetail) ||
          (onlyOnSale === undefined && onlyOnRent === undefined && !previousPageIsLandDetail) ||
          onlyOnSale
        browseOpts.withCredits = status === AssetStatusFilter.ONLY_MINTING || status === AssetStatusFilter.ON_SALE

        // We also set the fetch function as onBrowse because we need the url to be updated.
        fetchAssetsFn = onBrowse
      }
      fetchAssetsFn(browseOpts)

      setHasFetched(true)
    }
  }, [
    isMap,
    isFullscreen,
    view,
    vendor,
    section,
    address,
    contracts,
    onlyOnSale,
    onlySmart,
    viewInState,
    onFetchAssetsFromRoute,
    hasFetched,
    onlyOnRent,
    onBrowse,
    isMapPropertyPersisted,
    visitedLocations
  ])

  const left = isListsSection(section) ? null : (
    <>
      <NotMobile>
        {isAccountOrCurrentAccount ? (
          <AccountSidebar address={address!} isCurrentAccount={isCurrentAccount} />
        ) : (
          <NFTSidebar section={section} sections={sections} />
        )}
      </NotMobile>
    </>
  )

  let right: ReactNode

  switch (section) {
    case DecentralandSection.COLLECTIONS:
      right = <CollectionList creator={address ?? ''} />
      break
    case DecentralandSection.ON_SALE:
      right = <OnSaleList address={address} isCurrentAccount={isCurrentAccount} onSaleOrRentType={OnSaleOrRentType.SALE} />
      break
    case DecentralandSection.ON_RENT:
      right = <OnSaleList address={address} isCurrentAccount={isCurrentAccount} onSaleOrRentType={OnSaleOrRentType.RENT} />
      break
    case DecentralandSection.SALES:
      right = <Sales />
      break
    case DecentralandSection.BIDS:
      right = <Bids />
      break
    case DecentralandSection.STORE_SETTINGS:
      right = <StoreSettings />
      break
    case DecentralandSection.ENS:
      right = (
        <>
          <AssetTopbar disableSearchDropdown={disableSearchDropdown} />
          <AssetList isManager={isCurrentAccount} />
        </>
      )
      break
    default:
      right = (
        <>
          {isMap && isFullscreen ? (
            <MapTopbar showOwned={showOwnedLandOnMap} onShowOwnedChange={(show: boolean) => setShowOwnedLandOnMap(show)} />
          ) : (
            <AssetTopbar />
          )}
          {isMap ? <MapBrowse showOwned={showOwnedLandOnMap} /> : <AssetList isManager={isCurrentAccount} />}
        </>
      )
  }

  const mobileSections = [
    Sections.decentraland.COLLECTIONS,
    Sections.decentraland.LAND,
    Sections.decentraland.WEARABLES,
    Sections.decentraland.EMOTES,
    Sections.decentraland.ON_SALE,
    Sections.decentraland.ON_RENT,
    Sections.decentraland.SALES,
    Sections.decentraland.BIDS,
    Sections.decentraland.STORE_SETTINGS
  ].filter(Boolean)

  return (
    <>
      {isCurrentAccount ? (
        <Mobile>
          <Tabs isFullscreen>
            <Tabs.Left>
              {mobileSections.map((value, key) => (
                <Tabs.Tab
                  key={key}
                  active={section === value}
                  onClick={
                    value === Sections.decentraland.COLLECTIONS
                      ? () => changeFilter('section', Sections.decentraland.COLLECTIONS, { clearOldFilters: true })
                      : () => onBrowse({ section: value })
                  }
                >
                  {t(`menu.${value}`)}
                </Tabs.Tab>
              ))}
            </Tabs.Left>
          </Tabs>
        </Mobile>
      ) : null}
      <Page className={classNames('AssetBrowse', isMap && 'is-map')} isFullscreen={isFullscreen}>
        <Row>
          {!isFullscreen && left && (
            <Column align="left" className="sidebar">
              {left}
            </Column>
          )}
          <Column align={!left ? 'center' : 'right'} grow={true}>
            {right}
          </Column>
        </Row>
      </Page>
      <BackToTopButton />
    </>
  )
}

export default React.memo(AssetBrowse)

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChainId, Order } from '@dcl/schemas'
import { AuthorizationType, Authorization as Authorizations } from 'decentraland-dapps/dist/modules/authorization/types'
import { t } from 'decentraland-dapps/dist/modules/translation/utils'
import { ContractName } from 'decentraland-transactions'
import { Table, Loader, TextFilter, Dropdown, Pagination, NotMobile } from 'decentraland-ui'
import { config } from '../../config'
import { useAuthorization } from '../../lib/authorization'
import { NFT } from '../../modules/nft/types'
import { SortBy } from '../../modules/routing/types'
import { VendorName } from '../../modules/vendor'
import { LEGACY_MARKETPLACE_MAINNET_CONTRACT } from '../../modules/vendor/decentraland'
import OnRentListElement from './OnRentListElement'
import { Props as OnRentListElementProps } from './OnRentListElement/OnRentListElement.types'
import OnSaleListElement from './OnSaleListElement'
import { Props as OnSaleListElementProps } from './OnSaleListElement/OnSaleListElement.types'
import { useProcessedElements } from './utils'
import { OnSaleOrRentType, Props, isOnSaleListElementProps } from './OnSaleOrRentList.types'
import './OnSaleOrRentList.css'

const ROWS_PER_PAGE = 12

const OnSaleOrRentList = ({ elements, isLoading, onSaleOrRentType, onFetchAuthorizations, onRevoke, wallet }: Props) => {
  const [authorization, setAuthorization] = useState<Authorizations | null>(null)
  const [nftsWithOpenOrders, setNftsWithOpenOrders] = useState<NFT<VendorName.DECENTRALAND>[]>([])

  useEffect(() => {
    if (elements && elements.length) {
      const legacyMarketplaceOrder = elements.find(
        (el: OnSaleListElementProps | OnRentListElementProps) =>
          isOnSaleListElementProps(el) && el.order && el.order.marketplaceAddress === LEGACY_MARKETPLACE_MAINNET_CONTRACT
      )
      if (legacyMarketplaceOrder && legacyMarketplaceOrder.nft?.contractAddress) {
        const authorization: Authorizations = {
          address: wallet?.address || '',
          authorizedAddress: LEGACY_MARKETPLACE_MAINNET_CONTRACT,
          contractAddress: legacyMarketplaceOrder.nft.contractAddress,
          contractName: ContractName.ERC721,
          chainId: ChainId.ETHEREUM_MAINNET,
          type: AuthorizationType.APPROVAL
        }
        setAuthorization(authorization)
      }
    }
  }, [elements, wallet?.address])

  const [, isAuthorized] = useAuthorization(authorization, onFetchAuthorizations)

  const showRents = onSaleOrRentType === OnSaleOrRentType.RENT
  const perPage = useRef(ROWS_PER_PAGE)
  const sortOptions = useRef([
    { value: SortBy.NEWEST, text: t('filters.newest') },
    { value: SortBy.NAME, text: t('filters.name') }
  ])

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(SortBy.NEWEST)
  const [page, setPage] = useState(1)

  const processedElements = useProcessedElements(
    [...elements, ...(nftsWithOpenOrders as OnSaleListElementProps[])],
    search,
    sort,
    page,
    perPage.current
  )

  const showPagination = processedElements.total / perPage.current > 1

  const searchNode = useMemo(
    () => (
      <TextFilter
        value={search}
        onChange={val => {
          setSearch(val)
          setPage(1)
        }}
        placeholder={t('on_sale_list.search', { count: elements.length })}
      />
    ),
    [elements.length, search]
  )

  useEffect(() => {
    const fetchOrders = async () => {
      if (wallet?.address && elements && !isLoading) {
        try {
          const response = await fetch(`${config.get('MARKETPLACE_SERVER_URL')}/orders?&owner=${wallet.address}&status=transferred`)
          const data: { data: Order[] } = await response.json()
          const nftIds = data.data.map(order => `${order.contractAddress}-${order.tokenId}`)
          const nftIdsNotInElements = nftIds.filter(nftId => !elements.some(element => element.nft?.id === nftId))
          const nftPromises = nftIdsNotInElements.map(nftId =>
            fetch(
              `${config.get('MARKETPLACE_SERVER_URL')}/nfts?contractAddress=${nftId.split('-')[0]}&tokenId=${nftId.split('-')[1]}&first=1`
            ).then(response => response.json())
          )
          const nftsResponses: { data: NFT[] }[] = await Promise.all(nftPromises)
          setNftsWithOpenOrders(nftsResponses.map(nftResponse => nftResponse.data[0]))
        } catch (error) {
          console.error('Error fetching orders:', error)
        }
      }
    }
    void fetchOrders()
  }, [wallet?.address, elements, isLoading])

  return (
    <div className="onSaleOrRentTable">
      <div className="filters">
        <div className="search">{searchNode}</div>
        <Dropdown direction="left" value={sort} options={sortOptions.current} onChange={(_, data) => setSort(data.value as SortBy)} />
      </div>
      {isLoading ? (
        <>
          <div className="overlay" />
          <Loader size="massive" active />
        </>
      ) : (
        <>
          <Table basic="very">
            <NotMobile>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell className="itemTitle">
                    <span>{t('global.item')}</span>
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    <span>{t('global.type')}</span>
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    <span>{showRents ? t('global.status') : t('global.sale_type')}</span>
                  </Table.HeaderCell>
                  <Table.HeaderCell>
                    <span>{showRents ? t('global.rent_price') : t('global.sell_price')}</span>
                  </Table.HeaderCell>
                  <Table.HeaderCell className="actions">
                    <span>{t('global.actions')}</span>
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Header>
            </NotMobile>
            <Table.Body>
              {processedElements.paginated.map(element =>
                showRents && element.nft && element.rental ? (
                  <OnRentListElement key={`n-${element.nft.id}`} nft={element.nft} rental={element.rental} />
                ) : (
                  <OnSaleListElement
                    key={element.item ? `i-${element.item.id}` : `n-${element.nft!.id}`}
                    authorization={authorization}
                    isAuthorized={isAuthorized}
                    onRevoke={onRevoke}
                    wallet={wallet}
                    {...element}
                  />
                )
              )}
            </Table.Body>
          </Table>
          {processedElements.total === 0 && <div className="empty">{t('global.no_results')}</div>}
          {showPagination && (
            <div className="pagination">
              <Pagination
                totalPages={Math.ceil(processedElements.total / perPage.current)}
                activePage={page}
                onPageChange={(_, data) => setPage(Number(data.activePage))}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default React.memo(OnSaleOrRentList)

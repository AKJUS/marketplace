import { useTabletAndBelowMediaQuery } from 'decentraland-ui/dist/components/Media'
import { renderWithProviders } from '../../../utils/test'
import { MoreFilters, MoreFiltersProps } from './MoreFilters'

jest.mock('decentraland-ui/dist/components/Media', () => ({
  useTabletAndBelowMediaQuery: jest.fn()
}))

function renderMoreFilters(props: Partial<MoreFiltersProps> = {}) {
  return renderWithProviders(<MoreFilters onSaleChange={jest.fn()} {...props} />)
}

describe('MoreFilters', () => {
  let useTabletAndBelowMediaQueryMock: jest.MockedFunction<typeof useTabletAndBelowMediaQuery>

  beforeEach(() => {
    useTabletAndBelowMediaQueryMock = useTabletAndBelowMediaQuery as jest.MockedFunction<typeof useTabletAndBelowMediaQuery>
  })

  describe('when the isOnSale filter is visible', () => {
    it('should render the more filters section', () => {
      const { container } = renderMoreFilters({ isOnSale: true })
      expect(container).not.toBeEmptyDOMElement()
    })
  })

  describe('when the isOnSale filter is not visible', () => {
    describe('and the selected category is not wearables', () => {
      it('should not render the more filters section', () => {
        const { container } = renderMoreFilters({
          isOnSale: undefined
        })
        expect(container).toBeEmptyDOMElement()
      })
    })

    describe('and the selected category is wearables but the dispositive is not mobile nor tablet', () => {
      beforeEach(() => {
        useTabletAndBelowMediaQueryMock.mockReturnValue(false)
      })

      it('should not render the more filters section', () => {
        const { container } = renderMoreFilters({
          isOnSale: undefined
        })
        expect(container).toBeEmptyDOMElement()
      })
    })
  })
})

Component({
  properties: {
    label: { type: String, value: '' },
    icon: { type: String, value: '' },
    variant: { type: String, value: 'primary' }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap');
    }
  }
});

Component({
  properties: {
    icon: { type: String, value: '' },
    title: { type: String, value: '' },
    hint: { type: String, value: '' },
    buttonText: { type: String, value: '' }
  },
  methods: {
    onAction() {
      this.triggerEvent('action');
    }
  }
});

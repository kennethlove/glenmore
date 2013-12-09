/* Difference Scoring:
 *
 * 1 -> 1
 * 2 -> 2
 * 3 -> 3
 * 4 -> 5
 * 5+ -> 8
 *
*/

var GlenMore = new Marionette.Application();

GlenMore.addRegions({
    mainRegion: '#main',
    tabs: '#tabs',
    forms: '#forms',
    newuser: '#new_user'
});

GlenMore.Round = Backbone.RelationalModel.extend({
    defaults: {
        number: 1,
        whiskey: 0,
        tams: 0,
        locations: 0,
        score: 0
    },
    relations: [{
        type: Backbone.HasOne,
        key: 'user',
        relatedModel: 'GlenMore.User'
    }]
});

GlenMore.FinalScoring = Backbone.RelationalModel.extend({
    defaults: {
        special: 0,
        coins: 0,
        tiles: 0,
        victory: 0,
        total: 0
    },
    relations: [{
        type: Backbone.HasOne,
        key: 'user',
        relatedModel: 'GlenMore.User'
    }]
});

GlenMore.Rounds = Backbone.Collection.extend({
    model: GlenMore.Round
});

GlenMore.User = Backbone.RelationalModel.extend({
    defaults: {
        id: 0,
        name: 'William Wallace',
        slug: 'william-wallace'
    },
    relations: [{
        type: Backbone.HasMany,
        key: 'rounds',
        relatedModel: 'GlenMore.Round',
        collectionType: 'GlenMore.Rounds'
    }, {
        type: Backbone.HasOne,
        key: 'final',
        relatedModel: 'GlenMore.FinalScoring'
    }]
});

GlenMore.Users = Backbone.Collection.extend({
    localStorage: new Backbone.LocalStorage('glenmore-users'),
    model: GlenMore.User,
    save: function() {
        this.each(function(model) {
            Backbone.localSync('update', model);
        });
    },
    nextId: function() {
        if (!this.length) return 1;
        return this.last().get('id') + 1;
    }
});

GlenMore.TabView = Marionette.ItemView.extend({
    template: '#tab_template',
    tagName: 'li',
    events: {
        'click a': 'showUser'
    },
    showUser: function(e) {
        e.preventDefault();
        this.model.collection.trigger('user:show', this.model);
    }
});

GlenMore.UserTabs = Marionette.CollectionView.extend({
    itemView: GlenMore.TabView,
    tagName: 'ul',
    className: 'nav nav-pills'
});

GlenMore.FormView = Marionette.ItemView.extend({
    template: '#round_form_template',
    className: 'row',
    tagName: 'fieldset',
    events: {
        'click .remove-user': 'removeUser'
    },
    removeUser: function(e) {
        e.preventDefault();
        this.model.collection.trigger('user:remove', this.model);
    },
    template: function(serialized_model) {
        var template_html = $('#round_form_template').html();
        var context = {
            name: serialized_model.name,
            slug: serialized_model.slug,
            rounds: serialized_model.rounds,
            round: {number: serialized_model.rounds.length + 1}
        }
        return _.template(template_html, context);
    }
});

GlenMore.FinalFormView = Marionette.ItemView.extend({
    template: '#final_form_template',
    className: 'row',
    tagName: 'fieldset',
    template: function(serialized_model) {
        var template_html = $('#final_form_template').html();
        var context = {
            slug: serialized_model.slug,
        }
        return _.template(template_html, context);
    }
});

GlenMore.AddUserFormView = Marionette.ItemView.extend({
    template: '#add_user_form_template',
    className: 'tab-pane',
    id: 'add-user',
    events: {
        'click form .btn': 'newUser',
        'submit form': 'newUser',
        'click #calculate': 'calculate'
    },
    newUser: function(e) {
        e.preventDefault();
        var data = Backbone.Syphon.serialize(this);
        data.slug = data.name.split(' ').join('-').toLowerCase();
        this.trigger('form:submit', data);
        $(e.target).parent('form').find('input').val('');
    },
    calculate: function(e) {
        e.preventDefault();
        var users = GlenMore.game_users;
        var dummy_user = new GlenMore.User();
        
        // reset all final scores to 0
        _.each(users.models, function(user) {
            if (user.has('final')) {
                user.get('final').set('total', 0);
            }
        });
        
        // get lowest tile count from all users
        var lowest_tile = (_.map(users.models, function(user) {
            try {
                return user.get('final').get('tiles');
            } catch (e) {
                return 1;
            }
        })).sort(function(a, b) { return b < a })[0];
        
        // for each round, get lowest count in each category
        var final_rounds = new Backbone.Collection(),
            round_one = new GlenMore.Round({whiskey: null, locations: null, tams: null}),
            round_two = new GlenMore.Round({whiskey: null, locations: null, tams: null}),
            round_three = new GlenMore.Round({whiskey: null, locations: null, tams: null});
        _.each(users.models, function(user) {
            _.each(user.get('rounds').models, function(round) {
                final_rounds.push(round);
            });
        });
        
        var rounds = new Backbone.Collection([round_one, round_two, round_three]);
        for (var i = 1; i < 4; i++) {
            var this_round = rounds.at(i-1);
            _.each(final_rounds.where({number: i}), function(round) {
                if (this_round !== undefined) {
                    if (!this_round.has('whiskey') || round.get('whiskey') < this_round.get('whiskey')) {
                        this_round.set('whiskey', round.get('whiskey'))
                    }
                    if (!this_round.has('tams') || round.get('tams') < this_round.get('tams')) {
                        this_round.set('tams', round.get('tams'))
                    }
                    if (!this_round.has('locations') || round.get('locations') < this_round.get('locations')) {
                        this_round.set('locations', round.get('locations'))
                    }
                    this_round.set('number', round.get('number'))
                }
            });
        }
        
        // generate score per round per player and set on model
        _.map(users.models, function(user) {
            _.map(user.get('rounds').models, function(round) {
                console.log(round);
            });
        });
        
        // add in victory points, coins, and tile bonuses
        _.each(users.models, function(user) {
            if (user.has('final')) {
                var final = user.get('final'),
                    vp = final.get('victory'),
                    coins = final.get('coins'),
                    special = final.get('special'),
                    total = final.get('total');
                    
                final.set('total', total + vp + coins + special);
            }
        });
        
        // subtract tile overages
        _.each(users.models, function(user) {
            var tiles = 1,
                penalty = 0;
            if (user.has('final')) {
                tiles = user.get('final').get('tiles');
            }
            if (tiles > lowest_tile) {
                penalty = (tiles - lowest_tile) * 3;
                var total = user.get('final').get('total');
                user.get('final').set({
                    total: total - penalty
                });
            }
        });
        
        // set final score per player
        _.each(users.models, function(user) {
            console.log('final', user.get('final'));
        });
    }
});

GlenMore.UserForms = Marionette.CollectionView.extend({
    itemView: GlenMore.FormView,
    tagName: 'div',
    className: 'tab-content',
});

GlenMore.Record = Marionette.ItemView.extend({
    tagName: 'tr',
    template: '#round_template'
});

GlenMore.Records = Marionette.CompositeView.extend({
    itemView: GlenMore.Record,
    template: '#records_template',
    itemViewContainer: 'tbody',
    tagName: 'table',
    className: 'scores table table-condensed table-hover'
});

GlenMore.FinalView = Marionette.ItemView.extend({
    tagName: 'tr',
    template: '#final_row_template'
});

GlenMore.FinalRound = Marionette.CompositeView.extend({
    itemView: GlenMore.FinalView,
    template: '#final_template',
    itemViewContainer: 'tbody',
    tagName: 'table',
    className: 'scores final table table-condensed'
});

GlenMore.TotalUserView = Marionette.Layout.extend({
    template: '#user_template',
    regions: {
        rounds: '#rounds',
        final: '#final',
        total: '#total',
        form: '.score-entry'
    },
    events: {
        'submit form': 'roundFormSave'
    },
    roundFormSave: function(e) {
        e.preventDefault();
        var data = Backbone.Syphon.serialize(this);
        data['model'] = this.model;
        if (data['round-type'] === 'round') {
            this.model.trigger('round:save', data);
        } else {
            this.model.trigger('final:save', data);
        }
    },
});


GlenMore.on('initialize:after', function() {
    GlenMore.game_users = new GlenMore.Users;
    var users = GlenMore.game_users;
    users.fetch();
    users.on('add', function(user) {
        this.save();
    });
    users.on('user:remove', function(user) {
        deletedUser = this.get({id: user.get('id')});
        deletedUser.destroy();
    });
    users.on('round:save', function(data) {
        var user = this.get(data.model.get('id'));
        user.get('rounds').add({
            user: user,
            whiskey: parseInt(data.whiskey, 10) || 0,
            tams: parseInt(data.tams, 10) || 0,
            locations: parseInt(data.locations, 10) || 0,
            number: user.get('rounds').length + 1
        });
        this.save();
        this.trigger('user:show', user);
    });
    users.on('final:save', function(data) {
        var user = this.get(data.model.get('id'));
        var final = new GlenMore.FinalScoring({
            user: user
        });
        final.set({
            special: parseInt(data.special, 10) || 0,
            coins: parseInt(data.coins, 10) || 0,
            tiles: parseInt(data.tiles, 10) || 1,
            victory: parseInt(data.victory, 10) || 0
        });
        user.set({final: final});
        this.save();
        this.trigger('user:show', user);
    });
    users.on('user:show', function(user) {
        var totalUserView = new GlenMore.TotalUserView({
            model: user
        });
        GlenMore.forms.show(totalUserView);
        
        var userFormView = undefined;
        if (user.get('final') === null) {
            if (user.get('rounds').length === 3) {
                userFormView = new GlenMore.FinalFormView({
                    model: user
                });
            } else if (user.get('rounds').length < 3) {
                userFormView = new GlenMore.FormView({
                    model: user
                });
            }
        }
        if (userFormView !== undefined) {
            totalUserView.form.show(userFormView);
        }
        
        var scoreView = new GlenMore.Records({
            collection: user.get('rounds')
        });
        totalUserView.rounds.show(scoreView);
        
        if (user.has('final')) {
            var finalView = new GlenMore.FinalRound({
                collection: new Backbone.Collection([user.get('final')])
            });
            totalUserView.final.show(finalView);
        }
    });

    var tabsView = new GlenMore.UserTabs({
        collection: users
    });
    tabsView.on('collection:rendered', function() {
        this.$el.find('li:first').addClass('active');
        if (users.length !== 0) {
            users.trigger('user:show', users.first());
        }
    });

    var addUserForm = new GlenMore.AddUserFormView();
    addUserForm.on('form:submit', function(data) {
        data.id = users.nextId();
        users.add(data);
    });

    GlenMore.tabs.show(tabsView);
    GlenMore.newuser.show(addUserForm);
});

GlenMore.start();
